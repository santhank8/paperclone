import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "devin");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "devin_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "devin_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const runtimeEnv = Object.fromEntries(
    Object.entries(ensurePathInEnv({ ...process.env, ...env })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "devin_command_found",
      level: "info",
      message: `Devin CLI command resolved: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "devin_command_missing",
      level: "error",
      message: err instanceof Error ? err.message : `Command not found: ${command}`,
      hint: "Install Devin CLI: https://docs.devin.ai",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  try {
    const versionProc = await runChildProcess("devin-version-probe", command, ["version"], {
      cwd,
      env: runtimeEnv,
      timeoutSec: 10,
      graceSec: 5,
      onLog: async () => {},
    });

    const versionOutput =
      firstNonEmptyLine(versionProc.stdout) || firstNonEmptyLine(versionProc.stderr);

    if ((versionProc.exitCode ?? 0) === 0 && isNonEmpty(versionOutput)) {
      checks.push({
        code: "devin_version_ok",
        level: "info",
        message: `Devin CLI version: ${versionOutput}`,
      });
    } else {
      checks.push({
        code: "devin_version_warn",
        level: "warn",
        message: "Could not read Devin CLI version",
        hint: "Run `devin version` manually to verify the installation.",
      });
    }
  } catch {
    checks.push({
      code: "devin_version_warn",
      level: "warn",
      message: "Could not run `devin version`",
      hint: "Verify Devin CLI is correctly installed.",
    });
  }

  const model = asString(config.model, "").trim();
  if (isNonEmpty(model)) {
    checks.push({
      code: "devin_model_configured",
      level: "info",
      message: `Model configured: ${model}`,
    });
  } else {
    checks.push({
      code: "devin_model_default",
      level: "info",
      message: "No model configured; Devin will use its default model.",
    });
  }

  const permissionMode = asString(config.permissionMode, "dangerous").trim();
  if (permissionMode !== "auto" && permissionMode !== "dangerous") {
    checks.push({
      code: "devin_permission_mode_invalid",
      level: "warn",
      message: `Unknown permissionMode value: "${permissionMode}"`,
      hint: 'Valid values are "auto" or "dangerous".',
    });
  } else {
    checks.push({
      code: "devin_permission_mode_ok",
      level: "info",
      message: `Permission mode: ${permissionMode}`,
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
