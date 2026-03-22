import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asBoolean,
  asNumber,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import path from "node:path";
import { detectClaudeLoginRequired, parseClaudeStreamJson } from "./parse.js";

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

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
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
  const command = asString(config.command, "claude");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "claude_cwd_valid",
      level: "info",
      message: `工作目录有效：${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "工作目录无效",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "claude_command_resolvable",
      level: "info",
      message: `命令可执行：${command}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "命令不可执行",
      detail: command,
    });
  }

  const configApiKey = env.ANTHROPIC_API_KEY;
  const hostApiKey = process.env.ANTHROPIC_API_KEY;
  if (isNonEmpty(configApiKey) || isNonEmpty(hostApiKey)) {
    const source = isNonEmpty(configApiKey) ? "适配器配置环境变量" : "服务器环境变量";
    checks.push({
      code: "claude_anthropic_api_key_overrides_subscription",
      level: "warn",
      message:
        "已设置 ANTHROPIC_API_KEY。Claude 将使用 API 密钥认证而非订阅凭据。",
      detail: `在 ${source} 中检测到。`,
      hint: "如果希望使用基于订阅的 Claude 登录方式，请取消设置 ANTHROPIC_API_KEY。",
    });
  } else {
    checks.push({
      code: "claude_subscription_mode_possible",
      level: "info",
      message: "未设置 ANTHROPIC_API_KEY；如果 Claude 已登录，可使用基于订阅的认证。",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "claude_cwd_invalid" && check.code !== "claude_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "claude")) {
      checks.push({
        code: "claude_hello_probe_skipped_custom_command",
        level: "info",
        message: "由于命令不是 `claude`，已跳过 hello 探测。",
        detail: command,
        hint: "使用 `claude` CLI 命令运行自动登录和安装探测。",
      });
    } else {
      const model = asString(config.model, "").trim();
      const effort = asString(config.effort, "").trim();
      const chrome = asBoolean(config.chrome, false);
      const maxTurns = asNumber(config.maxTurnsPerRun, 0);
      const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
      if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (chrome) args.push("--chrome");
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `claude-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env,
          timeoutSec: 45,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );

      const parsedStream = parseClaudeStreamJson(probe.stdout);
      const parsed = parsedStream.resultJson;
      const loginMeta = detectClaudeLoginRequired({
        parsed,
        stdout: probe.stdout,
        stderr: probe.stderr,
      });
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "claude_hello_probe_timed_out",
          level: "warn",
          message: "Claude hello 探测超时。",
          hint: "请重试探测。如果问题持续，请手动在此目录中验证 Claude 是否可以运行 `Respond with hello`。",
        });
      } else if (loginMeta.requiresLogin) {
        checks.push({
          code: "claude_hello_probe_auth_required",
          level: "warn",
          message: "Claude CLI 已安装，但需要登录。",
          ...(detail ? { detail } : {}),
          hint: loginMeta.loginUrl
            ? `运行 \`claude login\` 并在 ${loginMeta.loginUrl} 完成登录，然后重试。`
            : "在此环境中运行 `claude login`，然后重试探测。",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsedStream.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "claude_hello_probe_passed" : "claude_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Claude hello 探测成功。"
            : "Claude 探测已运行，但未按预期返回 `hello`。",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "手动尝试探测（`claude --print - --output-format stream-json --verbose`）并提示 `Respond with hello`。",
              }),
        });
      } else {
        checks.push({
          code: "claude_hello_probe_failed",
          level: "error",
          message: "Claude hello 探测失败。",
          ...(detail ? { detail } : {}),
          hint: "在此目录中手动运行 `claude --print - --output-format stream-json --verbose` 并提示 `Respond with hello` 进行调试。",
        });
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
