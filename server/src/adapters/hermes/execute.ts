import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  AdapterSkill,
} from "@paperclipai/adapter-utils";
import { formatSelfContextBlock } from "@paperclipai/adapter-utils/self-context";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  buildExecutionEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import type { RunProcessResult } from "@paperclipai/adapter-utils/server-utils";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PAPERCLIP_SKILLS_CANDIDATES = [
  path.resolve(__moduleDir, "../../../skills"),
  path.resolve(__moduleDir, "../../../../../../skills"),
];

const HERMES_CLI = "hermes";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_TIMEOUT_SEC = 300;
const DEFAULT_GRACE_SEC = 10;
const VALID_PROVIDERS = [
  "auto", "openrouter", "nous", "openai-codex", "zai",
  "kimi-coding", "minimax", "minimax-cn",
];

async function resolvePaperclipSkillsDir(): Promise<string | null> {
  for (const candidate of PAPERCLIP_SKILLS_CANDIDATES) {
    const isDir = await fs.stat(candidate).then((s) => s.isDirectory()).catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}

async function buildSkillsDir(skills?: AdapterSkill[]): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-hermes-skills-"));
  const target = path.join(tmp, ".agents", "skills");
  await fs.mkdir(target, { recursive: true });

  if (skills && skills.length > 0) {
    for (const skill of skills) {
      const stat = await fs.stat(skill.path).catch(() => null);
      if (stat?.isDirectory()) {
        await fs.symlink(skill.path, path.join(target, skill.name));
      }
    }
    return tmp;
  }

  const skillsDir = await resolvePaperclipSkillsDir();
  if (!skillsDir) return tmp;
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await fs.symlink(
        path.join(skillsDir, entry.name),
        path.join(target, entry.name),
      );
    }
  }
  return tmp;
}

const SESSION_ID_REGEX = /^session_id:\s*(\S+)/m;
const SESSION_ID_REGEX_LEGACY = /session[_ ](?:id|saved)[:\s]+([a-zA-Z0-9_-]+)/i;
const TOKEN_USAGE_REGEX = /tokens?[:\s]+(\d+)\s*(?:input|in)\b.*?(\d+)\s*(?:output|out)\b/i;
const COST_REGEX = /(?:cost|spent)[:\s]*\$?([\d.]+)/i;

function parseHermesOutput(stdout: string, stderr: string) {
  const combined = stdout + "\n" + stderr;
  const result: Record<string, unknown> = {};

  const sessionMatch = stdout.match(SESSION_ID_REGEX);
  if (sessionMatch?.[1]) {
    result.sessionId = sessionMatch[1];
    const sessionLineIdx = stdout.lastIndexOf("\nsession_id:");
    if (sessionLineIdx > 0) {
      result.response = stdout.slice(0, sessionLineIdx).trim();
    }
  } else {
    const legacyMatch = combined.match(SESSION_ID_REGEX_LEGACY);
    if (legacyMatch?.[1]) {
      result.sessionId = legacyMatch[1];
    }
  }

  const usageMatch = combined.match(TOKEN_USAGE_REGEX);
  if (usageMatch) {
    result.usage = {
      inputTokens: parseInt(usageMatch[1], 10) || 0,
      outputTokens: parseInt(usageMatch[2], 10) || 0,
    };
  }

  const costMatch = combined.match(COST_REGEX);
  if (costMatch?.[1]) {
    result.costUsd = parseFloat(costMatch[1]);
  }

  if (stderr.trim()) {
    const errorLines = stderr
      .split("\n")
      .filter((line) => /error|exception|traceback|failed/i.test(line))
      .filter((line) => !/INFO|DEBUG|warn/i.test(line));
    if (errorLines.length > 0) {
      result.errorMessage = errorLines.slice(0, 5).join("\n");
    }
  }

  return result;
}

interface HermesRuntimeConfig {
  command: string;
  cwd: string;
  workspaceId: string | null;
  workspaceRepoUrl: string | null;
  workspaceRepoRef: string | null;
  env: Record<string, string>;
  timeoutSec: number;
  graceSec: number;
  extraArgs: string[];
}

async function buildHermesRuntimeConfig(input: {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  authToken?: string;
}): Promise<HermesRuntimeConfig> {
  const { runId, agent, config, context, authToken } = input;

  const command = asString(config.hermesCommand, HERMES_CLI);

  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "") || null;
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "") || null;
  const workspaceRepoRef = asString(workspaceContext.repoRef, "") || null;
  const workspaceBranch = asString(workspaceContext.branchName, "") || null;
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "") || null;
  const workspaceHints = Array.isArray(context.paperclipWorkspaces)
    ? context.paperclipWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimeServiceIntents = Array.isArray(context.paperclipRuntimeServiceIntents)
    ? context.paperclipRuntimeServiceIntents.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimeServices = Array.isArray(context.paperclipRuntimeServices)
    ? context.paperclipRuntimeServices.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimePrimaryUrl = asString(context.paperclipRuntimePrimaryUrl, "");

  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const injectedEnv: Record<string, string> = { ...buildPaperclipEnv(agent) };
  injectedEnv.PAPERCLIP_RUN_ID = runId;
  injectedEnv.AGENT_HOME = cwd;

  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeEventType =
    typeof context.eventType === "string" && context.eventType.trim().length > 0
      ? context.eventType.trim()
      : null;
  const wakeEventPayload = parseObject(context.eventPayload);
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const chatMessageId =
    typeof context.chatMessageId === "string" && context.chatMessageId.trim().length > 0
      ? context.chatMessageId.trim()
      : null;
  const chatSessionId =
    typeof context.chatSessionId === "string" && context.chatSessionId.trim().length > 0
      ? context.chatSessionId.trim()
      : null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (wakeTaskId) injectedEnv.PAPERCLIP_TASK_ID = wakeTaskId;
  if (wakeReason) injectedEnv.PAPERCLIP_WAKE_REASON = wakeReason;
  if (wakeCommentId) injectedEnv.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  if (wakeEventType) injectedEnv.PAPERCLIP_EVENT_TYPE = wakeEventType;
  if (wakeEventPayload) injectedEnv.PAPERCLIP_EVENT_PAYLOAD = JSON.stringify(wakeEventPayload);
  if (chatMessageId) injectedEnv.PAPERCLIP_CHAT_MESSAGE_ID = chatMessageId;
  if (chatSessionId) injectedEnv.PAPERCLIP_CHAT_SESSION_ID = chatSessionId;
  if (approvalId) injectedEnv.PAPERCLIP_APPROVAL_ID = approvalId;
  if (approvalStatus) injectedEnv.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  if (linkedIssueIds.length > 0) injectedEnv.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  if (effectiveWorkspaceCwd) injectedEnv.PAPERCLIP_WORKSPACE_CWD = effectiveWorkspaceCwd;
  if (workspaceSource) injectedEnv.PAPERCLIP_WORKSPACE_SOURCE = workspaceSource;
  if (workspaceStrategy) injectedEnv.PAPERCLIP_WORKSPACE_STRATEGY = workspaceStrategy;
  if (workspaceId) injectedEnv.PAPERCLIP_WORKSPACE_ID = workspaceId;
  if (workspaceRepoUrl) injectedEnv.PAPERCLIP_WORKSPACE_REPO_URL = workspaceRepoUrl;
  if (workspaceRepoRef) injectedEnv.PAPERCLIP_WORKSPACE_REPO_REF = workspaceRepoRef;
  if (workspaceBranch) injectedEnv.PAPERCLIP_WORKSPACE_BRANCH = workspaceBranch;
  if (workspaceWorktreePath) injectedEnv.PAPERCLIP_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  if (workspaceHints.length > 0) injectedEnv.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  if (runtimeServiceIntents.length > 0) injectedEnv.PAPERCLIP_RUNTIME_SERVICE_INTENTS_JSON = JSON.stringify(runtimeServiceIntents);
  if (runtimeServices.length > 0) injectedEnv.PAPERCLIP_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  if (runtimePrimaryUrl) injectedEnv.PAPERCLIP_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;

  const env = await buildExecutionEnv({
    globalEnvFile: asString(context.paperclipGlobalEnvFile, ""),
    configEnv: config.env,
    injectedEnv,
    authToken,
  });

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);
  const graceSec = asNumber(config.graceSec, DEFAULT_GRACE_SEC);
  const extraArgs = asStringArray(config.extraArgs);

  return {
    command,
    cwd,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;

  const model = asString(config.model, DEFAULT_MODEL);
  const provider = asString(config.provider, "");
  const toolsets = asString(config.toolsets, "");
  const persistSession = asBoolean(config.persistSession, true);
  const worktreeMode = asBoolean(config.worktreeMode, false);
  const checkpoints = asBoolean(config.checkpoints, false);
  const useQuiet = asBoolean(config.quiet, true);
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );

  const runtimeConfig = await buildHermesRuntimeConfig({
    runId,
    agent,
    config,
    context,
    authToken,
  });
  const { command, cwd, workspaceId, workspaceRepoUrl, workspaceRepoRef, env, timeoutSec, graceSec, extraArgs } = runtimeConfig;

  const skillsDir = await buildSkillsDir(ctx.skills);

  const prompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  });

  const paperclipChat = parseObject(context.paperclipChat);
  const chatMode = asString(paperclipChat.mode, "");
  const chatPrompt = asString(paperclipChat.promptText, "").trim();

  const selfContextBlock = formatSelfContextBlock(ctx.selfContext);
  const effectivePrompt =
    selfContextBlock +
    (chatMode === "interactive_chat" && chatPrompt ? chatPrompt : prompt);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const prevSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const canResume = persistSession && prevSessionId.length > 0;

  const args = ["chat", "-q", effectivePrompt];
  if (useQuiet) args.push("-Q");
  args.push("-m", model);
  if (provider && VALID_PROVIDERS.includes(provider)) {
    args.push("--provider", provider);
  }
  if (toolsets) args.push("-t", toolsets);
  if (worktreeMode) args.push("-w");
  if (checkpoints) args.push("--checkpoints");
  if (asBoolean(config.verbose, false)) args.push("-v");
  if (canResume) args.push("--resume", prevSessionId);
  if (extraArgs.length > 0) args.push(...extraArgs);

  if (onMeta) {
    await onMeta({
      adapterType: "hermes_local",
      command,
      cwd,
      commandArgs: args,
      env: redactEnvForLogs(env),
      prompt: effectivePrompt,
      context,
      skillsInjected: ctx.skills?.map((s) => s.name),
    });
  }

  try {
    const result = await runChildProcess(runId, command, args, {
      cwd,
      env,
      timeoutSec,
      graceSec,
      onLog,
    });

    const parsed = parseHermesOutput(result.stdout || "", result.stderr || "");

    const executionResult: AdapterExecutionResult = {
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      provider: provider || null,
      model,
    };

    if (result.timedOut) {
      executionResult.errorMessage = `Timed out after ${timeoutSec}s`;
      executionResult.errorCode = "timeout";
    }

    if (parsed.errorMessage) {
      executionResult.errorMessage = parsed.errorMessage as string;
    }

    if (parsed.usage) {
      executionResult.usage = parsed.usage as { inputTokens: number; outputTokens: number };
    }

    if (parsed.costUsd !== undefined) {
      executionResult.costUsd = parsed.costUsd as number;
    }

    if (parsed.response) {
      executionResult.summary = (parsed.response as string).slice(0, 2000);
    }

    const sessionId = parsed.sessionId as string | undefined;
    if (persistSession && sessionId) {
      executionResult.sessionId = sessionId;
      executionResult.sessionParams = {
        sessionId,
        cwd,
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
        ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
      };
      executionResult.sessionDisplayId = sessionId.slice(0, 16);
    }

    return executionResult;
  } finally {
    fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
  }
}
