import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asStringArray,
  parseObject,
  parseJson,
  buildPaperclipEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;

  // ── Config ──────────────────────────────────────────────────────────
  const command = asString(config.command, "openclaw");
  const agentId = asString(config.agentId, "main");
  const model = asString(config.model, "");
  const configuredCwd = asString(config.cwd, "");
  const timeoutSec = asNumber(config.timeoutSec, 600);
  const graceSec = asNumber(config.graceSec, 20);
  const thinking = asString(config.thinking, "");
  const extraArgs = asStringArray(config.extraArgs);

  // ── Workspace resolution ────────────────────────────────────────────
  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const cwd = workspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  // ── Session persistence ─────────────────────────────────────────────
  const runtimeSessionParams = parseObject(runtime?.sessionParams ?? {});
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime?.sessionId ?? "");
  const sessionId = runtimeSessionId || `paperclip-${agentId}-${runId}`;

  // ── Environment variables (Paperclip context) ───────────────────────
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;

  const wakeTaskId =
    nonEmpty(context.taskId) ?? nonEmpty(context.issueId);
  const wakeReason = nonEmpty(context.wakeReason);
  const wakeCommentId = nonEmpty(context.wakeCommentId) ?? nonEmpty(context.commentId);
  const approvalId = nonEmpty(context.approvalId);
  const approvalStatus = nonEmpty(context.approvalStatus);

  if (wakeTaskId) env.PAPERCLIP_TASK_ID = wakeTaskId;
  if (wakeReason) env.PAPERCLIP_WAKE_REASON = wakeReason;
  if (wakeCommentId) env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  if (approvalId) env.PAPERCLIP_APPROVAL_ID = approvalId;
  if (approvalStatus) env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;

  // User-provided env overrides
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  if (!envConfig.PAPERCLIP_API_KEY && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }

  // ── Build prompt ────────────────────────────────────────────────────
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.name}} ({{agent.id}}). Continue your Paperclip work.",
  );
  const prompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId },
    context,
  });

  // ── Build CLI args ──────────────────────────────────────────────────
  const args: string[] = [
    "agent",
    "--agent", agentId,
    "--session-id", sessionId,
    "--message", prompt,
    "--json",
    "--timeout", String(timeoutSec),
  ];

  if (thinking) args.push("--thinking", thinking);
  if (extraArgs.length > 0) args.push(...extraArgs);

  // ── Metadata ────────────────────────────────────────────────────────
  if (onMeta) {
    await onMeta({
      adapterType: "openclaw",
      command,
      cwd,
      commandArgs: args,
      env: redactEnvForLogs(env),
      prompt,
      context,
    });
  }

  await onLog("stdout", `[openclaw] spawning: ${command} agent --agent ${agentId} --session-id ${sessionId}\n`);
  await onLog("stdout", `[openclaw] cwd: ${cwd}\n`);
  await onLog("stdout", `[openclaw] wake reason: ${wakeReason ?? "manual"}, task: ${wakeTaskId ?? "none"}\n`);

  // ── Execute ─────────────────────────────────────────────────────────
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog,
  });

  // ── Parse result ────────────────────────────────────────────────────
  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `OpenClaw agent timed out after ${timeoutSec}s`,
      errorCode: "timeout",
    };
  }

  const parsed = parseJson(proc.stdout);
  if (!parsed) {
    const stderrLine = proc.stderr.split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? "";
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage: stderrLine
        ? `OpenClaw exited with code ${proc.exitCode ?? -1}: ${stderrLine}`
        : `OpenClaw exited with code ${proc.exitCode ?? -1}`,
      errorCode: "openclaw_parse_error",
      resultJson: { stdout: proc.stdout, stderr: proc.stderr },
    };
  }

  // ── Extract usage from OpenClaw JSON ────────────────────────────────
  const meta = parseObject(parsed.result ? parseObject((parsed as any).result).meta : {});
  const agentMeta = parseObject((meta as any).agentMeta ?? meta);
  const usageObj = parseObject((agentMeta as any).usage ?? {});
  const usage = {
    inputTokens: asNumber(usageObj.input, 0) + asNumber(usageObj.cacheRead, 0),
    cachedInputTokens: asNumber(usageObj.cacheRead, 0),
    outputTokens: asNumber(usageObj.output, 0),
  };

  const resultModel = asString((agentMeta as any).model, model);
  const costUsd = asNumber((agentMeta as any).costUsd, 0);

  // Extract text from payloads
  const payloads = Array.isArray((parsed as any).result?.payloads)
    ? (parsed as any).result.payloads
    : [];
  const summaryText = payloads
    .map((p: any) => typeof p?.text === "string" ? p.text : "")
    .filter(Boolean)
    .join("\n")
    .slice(0, 500);

  // ── Session persistence ─────────────────────────────────────────────
  const resolvedSessionParams = {
    sessionId,
    cwd,
    agentId,
  };

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: (proc.exitCode ?? 0) === 0 ? null : `OpenClaw exited with code ${proc.exitCode}`,
    errorCode: null,
    usage,
    sessionId,
    sessionParams: resolvedSessionParams,
    sessionDisplayId: sessionId,
    provider: asString((agentMeta as any).provider, "anthropic"),
    model: resultModel,
    billingType: "subscription",
    costUsd,
    resultJson: parsed,
    summary: summaryText || asString(parsed.summary, ""),
  };
}
