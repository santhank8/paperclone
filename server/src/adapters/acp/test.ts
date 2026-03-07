import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, asStringArray, parseObject, ensurePathInEnv, ensureAbsoluteDirectory, ensureCommandResolvable } from "../utils.js";

// ---------------------------------------------------------------------------
// ACP adapter — environment test
//
// Validates the ACP agent by:
//   1. Checking the command is resolvable
//   2. Checking the working directory
//   3. Spawning the process and sending `initialize`
//   4. Verifying the agent responds with valid capabilities
// ---------------------------------------------------------------------------

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "kiro-cli");
  const args = asStringArray(config.args).length > 0 ? asStringArray(config.args) : ["acp"];
  const cwd = asString(config.cwd, process.cwd());
  const envConfig = parseObject(config.env);

  // --- Check working directory ---
  try {
    await ensureAbsoluteDirectory(cwd);
    checks.push({
      code: "acp_cwd_valid",
      level: "info",
      message: `Working directory: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "acp_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
    return { adapterType: ctx.adapterType, status: "fail", checks, testedAt: new Date().toISOString() };
  }

  // --- Check command resolvable ---
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });

  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "acp_command_found",
      level: "info",
      message: `Command resolvable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "acp_command_not_found",
      level: "error",
      message: err instanceof Error ? err.message : `Command not found: ${command}`,
      hint: "Install the ACP agent CLI (e.g. `npm i -g kiro-cli`) or set adapterConfig.command to the full path.",
    });
    return { adapterType: ctx.adapterType, status: "fail", checks, testedAt: new Date().toISOString() };
  }

  // --- Spawn and test initialize handshake ---
  try {
    const result = await probeInitialize(command, args, cwd, runtimeEnv as Record<string, string>);
    if (result.success) {
      checks.push({
        code: "acp_initialize_ok",
        level: "info",
        message: `ACP agent responded: ${result.agentName ?? "unnamed"} v${result.agentVersion ?? "?"}`,
      });
      if (result.capabilities) {
        checks.push({
          code: "acp_capabilities",
          level: "info",
          message: `Capabilities: ${JSON.stringify(result.capabilities)}`,
        });
      }
    } else {
      checks.push({
        code: "acp_initialize_failed",
        level: "error",
        message: result.error ?? "ACP initialize handshake failed",
        hint: "Verify the agent supports ACP protocol version 1.",
      });
    }
  } catch (err) {
    checks.push({
      code: "acp_probe_error",
      level: "error",
      message: err instanceof Error ? err.message : "ACP probe failed",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Probe: spawn, initialize, kill
// ---------------------------------------------------------------------------

interface ProbeResult {
  success: boolean;
  agentName?: string;
  agentVersion?: string;
  capabilities?: Record<string, unknown>;
  error?: string;
}

function probeInitialize(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: "ACP initialize timed out (10s)" });
    }, 10_000);

    const proc = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    function cleanup() {
      clearTimeout(timeout);
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
    }

    proc.on("error", (err) => {
      cleanup();
      resolve({ success: false, error: err.message });
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        resolve({ success: false, error: `Process exited with code ${code}` });
      }
    });

    const rl = createInterface({ input: proc.stdout! });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 1 && msg.result) {
          const agentInfo = msg.result.agentInfo as Record<string, unknown> | undefined;
          cleanup();
          rl.close();
          resolve({
            success: true,
            agentName: agentInfo?.name as string | undefined,
            agentVersion: agentInfo?.version as string | undefined,
            capabilities: msg.result.agentCapabilities as Record<string, unknown> | undefined,
          });
        } else if (msg.id === 1 && msg.error) {
          cleanup();
          rl.close();
          resolve({ success: false, error: msg.error.message ?? "Initialize error" });
        }
      } catch {
        // Not JSON — ignore
      }
    });

    // Send initialize request
    proc.stdin?.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
        },
        clientInfo: { name: "paperclip", version: "1.0.0" },
      },
    }) + "\n");
  });
}
