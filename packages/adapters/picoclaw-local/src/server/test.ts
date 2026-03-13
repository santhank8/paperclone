import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  parseObject,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { discoverPicoClawModelsCached } from "./models.js";
import { extractPicoClawSummary } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

function resolvePicoClawConfigPath(env: Record<string, string>): string {
  const explicitConfig = env.PICOCLAW_CONFIG?.trim();
  if (explicitConfig) return path.resolve(explicitConfig);

  const explicitHome = env.PICOCLAW_HOME?.trim();
  if (explicitHome) return path.resolve(explicitHome, "config.json");

  return path.join(os.homedir(), ".picoclaw", "config.json");
}

const PICOCLAW_AUTH_REQUIRED_RE =
  /(?:auth(?:entication)?\s+required|api\s*key|invalid\s*api\s*key|provider|config)/i;

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "picoclaw");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: false });
    checks.push({
      code: "picoclaw_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "picoclaw_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env = normalizeEnv(envConfig);
  const runtimeEnv = normalizeEnv(ensurePathInEnv({ ...process.env, ...env }));

  const cwdInvalid = checks.some((check) => check.code === "picoclaw_cwd_invalid");
  if (!cwdInvalid) {
    try {
      await ensureCommandResolvable(command, cwd, runtimeEnv);
      checks.push({
        code: "picoclaw_command_resolvable",
        level: "info",
        message: `Command is executable: ${command}`,
      });
    } catch (err) {
      checks.push({
        code: "picoclaw_command_unresolvable",
        level: "error",
        message: err instanceof Error ? err.message : "Command is not executable",
        detail: command,
      });
    }
  }

  const canRunProbe =
    checks.every(
      (check) =>
        check.code !== "picoclaw_cwd_invalid" && check.code !== "picoclaw_command_unresolvable",
    );

  if (canRunProbe) {
    const configPath = resolvePicoClawConfigPath(runtimeEnv);
    const configExists = await fs.stat(configPath).then((stat) => stat.isFile()).catch(() => false);
    checks.push(
      configExists
        ? {
            code: "picoclaw_config_found",
            level: "info",
            message: `PicoClaw config found: ${configPath}`,
          }
        : {
            code: "picoclaw_config_missing",
            level: "error",
            message: `PicoClaw config not found: ${configPath}`,
            hint: "Run `picoclaw onboard` on the machine running Paperclip, then retry.",
          },
    );
  }

  if (canRunProbe) {
    try {
      const discovered = await discoverPicoClawModelsCached({ command, cwd, env: runtimeEnv });
      if (discovered.length > 0) {
        checks.push({
          code: "picoclaw_models_discovered",
          level: "info",
          message: `Discovered ${discovered.length} model(s) from PicoClaw.`,
        });
      } else {
        checks.push({
          code: "picoclaw_models_empty",
          level: "warn",
          message: "PicoClaw returned no configured models.",
          hint: "Run `picoclaw model` and make sure your config has at least one model.",
        });
      }
    } catch (err) {
      checks.push({
        code: "picoclaw_models_discovery_failed",
        level: "warn",
        message: err instanceof Error ? err.message : "PicoClaw model discovery failed.",
        hint: "Run `picoclaw model` manually to verify your local setup.",
      });
    }
  }

  const configuredModel = asString(config.model, "").trim();
  if (configuredModel) {
    try {
      const discovered = await discoverPicoClawModelsCached({ command, cwd, env: runtimeEnv });
      const modelExists = discovered.some((m: { id: string }) => m.id === configuredModel);
      checks.push(
        modelExists
          ? {
              code: "picoclaw_model_configured",
              level: "info",
              message: `Configured model: ${configuredModel}`,
            }
          : {
              code: "picoclaw_model_not_found",
              level: "warn",
              message: `Configured model "${configuredModel}" was not found in PicoClaw config.`,
              hint: "Run `picoclaw model` and choose one of the configured model aliases.",
            },
      );
    } catch {
      checks.push({
        code: "picoclaw_model_configured",
        level: "info",
        message: `Configured model: ${configuredModel}`,
      });
    }
  } else {
    checks.push({
      code: "picoclaw_model_default",
      level: "info",
      message: "No explicit model configured. PicoClaw will use its default model.",
    });
  }

  if (canRunProbe && !checks.some((check) => check.code === "picoclaw_config_missing")) {
    const args = ["agent", "--message", "Respond with exactly hello.", "--session", "paperclip:envtest"];
    if (configuredModel) args.push("--model", configuredModel);

    try {
      const probe = await runChildProcess(
        `picoclaw-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env: runtimeEnv,
          timeoutSec: 60,
          graceSec: 5,
          onLog: async () => {},
        },
      );

      const summary = extractPicoClawSummary(probe.stdout);
      const detail = summary ?? firstNonEmptyLine(probe.stderr) ?? firstNonEmptyLine(probe.stdout);
      const evidence = `${probe.stdout}\n${probe.stderr}`.trim();

      if (probe.timedOut) {
        checks.push({
          code: "picoclaw_probe_timeout",
          level: "warn",
          message: "PicoClaw hello probe timed out.",
          hint: "Retry the probe. If this persists, run `picoclaw agent -m \"Respond with exactly hello.\"` manually.",
        });
      } else if ((probe.exitCode ?? 1) === 0 && summary && summary.toLowerCase().includes("hello")) {
        checks.push({
          code: "picoclaw_probe_ok",
          level: "info",
          message: "PicoClaw hello probe succeeded.",
        });
      } else if (PICOCLAW_AUTH_REQUIRED_RE.test(evidence)) {
        checks.push({
          code: "picoclaw_probe_auth_required",
          level: "warn",
          message: "PicoClaw is installed, but model/provider auth is not ready.",
          detail,
          hint: "Update ~/.picoclaw/config.json with working model credentials, then retry.",
        });
      } else {
        checks.push({
          code: "picoclaw_probe_failed",
          level: "warn",
          message: "PicoClaw hello probe failed.",
          detail,
          hint: "Run `picoclaw agent -m \"Respond with exactly hello.\"` manually in this working directory.",
        });
      }
    } catch (err) {
      checks.push({
        code: "picoclaw_probe_failed",
        level: "warn",
        message: "PicoClaw hello probe failed.",
        detail: err instanceof Error ? err.message : String(err),
        hint: "Run `picoclaw agent -m \"Respond with exactly hello.\"` manually in this working directory.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
