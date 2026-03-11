import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asBoolean,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectCodexAuthRequired, parseCodexJsonl } from "./parse.js";
import { loginCodexWithApiKey, resolveCodexAuthMode } from "./auth.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readEnvBindingValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type === "plain" && typeof record.value === "string") {
    return record.value;
  }
  return null;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string, parsedError: string | null): string | null {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "codex");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "codex_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    const resolved = readEnvBindingValue(value);
    if (typeof resolved === "string") env[key] = resolved;
  }
  const authModeSetting = asString(config.paperclipAuthMode, "").trim();
  const probeEnv: Record<string, string> = { ...env };
  if (!Object.prototype.hasOwnProperty.call(probeEnv, "OPENAI_API_KEY")) {
    const globalKey = process.env.OPENAI_API_KEY?.trim();
    if (authModeSetting === "instance_api_key") {
      probeEnv.OPENAI_API_KEY = globalKey ?? "";
    } else if (globalKey) {
      probeEnv.OPENAI_API_KEY = globalKey;
    }
  }
  const resolvedAuthMode = resolveCodexAuthMode(config, probeEnv);
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...probeEnv });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "codex_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const configOpenAiKey = env.OPENAI_API_KEY;
  const hostOpenAiKey = process.env.OPENAI_API_KEY;
  const authMode = asString(config.paperclipAuthMode, "").trim();
  const explicitSubscriptionOverride =
    authMode === "subscription" &&
    typeof configOpenAiKey === "string" &&
    configOpenAiKey.trim().length === 0;
  if (explicitSubscriptionOverride) {
    checks.push({
      code: "codex_subscription_override_active",
      level: "info",
      message:
        "Codex is explicitly set to local subscription/login. Inherited OPENAI_API_KEY will be ignored.",
      detail: isNonEmpty(hostOpenAiKey)
        ? "A server/container OPENAI_API_KEY is present, but this agent override blanks it at runtime."
        : "No OPENAI_API_KEY will be passed; Codex must rely on login/session auth in the Paperclip runtime environment.",
      hint: "In Docker, local login happens inside the Paperclip container/runtime, not your host shell.",
    });
  } else if (isNonEmpty(configOpenAiKey) || isNonEmpty(hostOpenAiKey)) {
    const source = isNonEmpty(configOpenAiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail:
        source === "server environment"
          ? "Detected in the Paperclip server/container environment."
          : `Detected in ${source}.`,
    });
  } else {
    checks.push({
      code: "codex_openai_api_key_missing",
      level: "warn",
      message: "OPENAI_API_KEY is not set. Codex runs may fail until authentication is configured.",
      hint:
        "Set OPENAI_API_KEY in adapter env/server env, or run `codex login` in the Paperclip runtime environment.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "codex_cwd_invalid" && check.code !== "codex_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "codex")) {
      checks.push({
        code: "codex_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `codex`.",
        detail: command,
        hint: "Use the `codex` CLI command to run the automatic login and installation probe.",
      });
    } else {
      const model = asString(config.model, "").trim();
      const modelReasoningEffort = asString(
        config.modelReasoningEffort,
        asString(config.reasoningEffort, ""),
      ).trim();
      const search = asBoolean(config.search, false);
      const bypass = asBoolean(
        config.dangerouslyBypassApprovalsAndSandbox,
        asBoolean(config.dangerouslyBypassSandbox, false),
      );
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = ["exec", "--json", "--skip-git-repo-check"];
      if (search) args.unshift("--search");
      if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
      if (model) args.push("--model", model);
      if (modelReasoningEffort) {
        args.push("-c", `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`);
      }
      if (extraArgs.length > 0) args.push(...extraArgs);
      args.push("-");

      const isolatedHomeDir =
        resolvedAuthMode === "api_key"
          ? await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-envtest-"))
          : null;
      if (isolatedHomeDir) {
        probeEnv.CODEX_HOME = isolatedHomeDir;
        probeEnv.HOME = isolatedHomeDir;
      }

      try {
        if (resolvedAuthMode === "api_key") {
          const apiKey = probeEnv.OPENAI_API_KEY?.trim() ?? "";
          if (!apiKey) {
            checks.push({
              code: "codex_hello_probe_auth_required",
              level: "warn",
              message: "Codex API-key mode is selected, but OPENAI_API_KEY is empty.",
              hint: "Save a valid OPENAI_API_KEY and retry the probe.",
            });
            return {
              adapterType: ctx.adapterType,
              status: summarizeStatus(checks),
              checks,
              testedAt: new Date().toISOString(),
            };
          }

          const login = await loginCodexWithApiKey({
            runId: `codex-envtest-login-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            command,
            cwd,
            env: probeEnv,
            apiKey,
          });
          if (login.timedOut || (login.exitCode ?? 1) !== 0) {
            const detail = summarizeProbeDetail(login.stdout, login.stderr, null);
            checks.push({
              code: "codex_hello_probe_auth_required",
              level: "warn",
              message: "Codex API-key login failed before the hello probe.",
              ...(detail ? { detail } : {}),
              hint: "Verify the saved OPENAI_API_KEY and retry the probe.",
            });
            return {
              adapterType: ctx.adapterType,
              status: summarizeStatus(checks),
              checks,
              testedAt: new Date().toISOString(),
            };
          }
        }

        const probe = await runChildProcess(
          `codex-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          args,
          {
            cwd,
            env: probeEnv,
            timeoutSec: 45,
            graceSec: 5,
            stdin: "Respond with hello.",
            onLog: async () => {},
          },
        );
        const parsed = parseCodexJsonl(probe.stdout);
        const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);

        if (probe.timedOut) {
          checks.push({
            code: "codex_hello_probe_timed_out",
            level: "warn",
            message: "Codex hello probe timed out.",
            hint: "Retry the probe. If this persists, verify Codex can run `Respond with hello` from this directory manually.",
          });
        } else if ((probe.exitCode ?? 1) === 0) {
          const summary = parsed.summary.trim();
          const hasHello = /\bhello\b/i.test(summary);
          checks.push({
            code: hasHello ? "codex_hello_probe_passed" : "codex_hello_probe_unexpected_output",
            level: hasHello ? "info" : "warn",
            message: hasHello
              ? "Codex hello probe succeeded."
              : "Codex probe ran but did not return `hello` as expected.",
            ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
            ...(hasHello
              ? {}
              : {
                  hint: "Try the probe manually (`codex exec --json -` then prompt: Respond with hello) to inspect full output.",
                }),
          });
        } else if (
          detectCodexAuthRequired({
            stdout: probe.stdout,
            stderr: probe.stderr,
            errorMessage: parsed.errorMessage,
          })
        ) {
          checks.push({
            code: "codex_hello_probe_auth_required",
            level: "warn",
            message: "Codex CLI is installed, but authentication is not ready.",
            ...(detail ? { detail } : {}),
            hint:
              "Configure OPENAI_API_KEY in adapter env/server env or run `codex login` in the Paperclip runtime environment, then retry the probe.",
          });
        } else {
          checks.push({
            code: "codex_hello_probe_failed",
            level: "error",
            message: "Codex hello probe failed.",
            ...(detail ? { detail } : {}),
            hint: "Run `codex exec --json -` manually in this working directory and prompt `Respond with hello` to debug.",
          });
        }
      } finally {
        if (isolatedHomeDir) {
          await fs.rm(isolatedHomeDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
