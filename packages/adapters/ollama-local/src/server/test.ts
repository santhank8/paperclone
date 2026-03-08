import type { AdapterEnvironmentTestResult, AdapterEnvironmentTestContext } from "@paperclipai/adapter-utils";
import { asString, asStringArray, runChildProcess } from "@paperclipai/adapter-utils/server-utils";

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const command = asString(ctx.config.command, "ollama");
  const extraArgs = asStringArray(ctx.config.extraArgs);

  const result: AdapterEnvironmentTestResult = {
    adapterType: "ollama_local",
    status: "fail",
    checks: [],
    testedAt: new Date().toISOString(),
  };

  try {
    const proc = await runChildProcess("test", command, ["--version", ...extraArgs], {
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      timeoutSec: 10,
      graceSec: 2,
      onLog: async () => {},
    });

    if (proc.exitCode === 0) {
      result.status = "pass";
      result.checks.push({
                level: "info",
        code: "cli_ok",
        message: `${command} is available`,
        detail: proc.stdout.trim(),
      });
      return result;
    }

    result.checks.push({
            level: "error",
      code: "cli_error",
      message: `Command exited with code ${proc.exitCode}`,
      detail: proc.stderr.trim() || proc.stdout.trim() || "Unknown error",
    });
    return result;
  } catch (err) {
    result.checks.push({
            level: "error",
      code: "cli_error",
      message: `Failed to execute ${command}`,
      detail: err instanceof Error ? err.message : String(err),
    });
    return result;
  }
}
