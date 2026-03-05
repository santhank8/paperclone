import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import {
  asString,
  asNumber,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  redactEnvForLogs,
  runChildProcess,
} from "../utils.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;
  const command = asString(config.command, "");
  if (!command) throw new Error("Process adapter missing command");

  const args = asStringArray(config.args);
  const cwd = asString(config.cwd, process.cwd());
  const envConfig = parseObject(config.env);
  const parsedContext = parseObject(context);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  const chatConversationId = asString(parsedContext.chatConversationId, "").trim()
    || asString(parsedContext.conversationId, "").trim();
  const chatMessageId = asString(parsedContext.chatMessageId, "").trim()
    || asString(parsedContext.messageId, "").trim();
  const chatThreadRootId = asString(parsedContext.chatThreadRootId, "").trim()
    || asString(parsedContext.threadRootMessageId, "").trim();
  const chatKind = asString(parsedContext.chatKind, "").trim() || asString(parsedContext.kind, "").trim();
  if (chatConversationId) env.PAPERCLIP_CHAT_CONVERSATION_ID = chatConversationId;
  if (chatMessageId) env.PAPERCLIP_CHAT_MESSAGE_ID = chatMessageId;
  if (chatThreadRootId) env.PAPERCLIP_CHAT_THREAD_ROOT_ID = chatThreadRootId;
  if (chatKind) env.PAPERCLIP_CHAT_KIND = chatKind;
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 15);

  if (onMeta) {
    await onMeta({
      adapterType: "process",
      command,
      cwd,
      commandArgs: args,
      env: redactEnvForLogs(env),
    });
  }

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog,
  });

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  if ((proc.exitCode ?? 0) !== 0) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage: `Process exited with code ${proc.exitCode ?? -1}`,
      resultJson: {
        stdout: proc.stdout,
        stderr: proc.stderr,
      },
    };
  }

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    resultJson: {
      stdout: proc.stdout,
      stderr: proc.stderr,
    },
  };
}
