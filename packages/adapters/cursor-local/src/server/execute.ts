import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inferOpenAiCompatibleBiller, type AdapterExecutionContext, type AdapterExecutionResult, type ExecutionSegment } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  buildInvocationEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePaperclipSkillSymlink,
  ensurePathInEnv,
  readPaperclipRuntimeSkillEntries,
  resolveCommandForLogs,
  resolvePaperclipDesiredSkillNames,
  removeMaintainerOnlySkillSymlinks,
  renderTemplate,
  renderPaperclipWakePrompt,
  stringifyPaperclipWakePayload,
  joinPromptSections,
  runChildProcess,
  PREFLIGHT_ORCHESTRATION_PROMPT,
  extractHandoffSection,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "../index.js";
import { parseCursorJsonl, isCursorUnknownSessionError } from "./parse.js";
import { normalizeCursorStreamLine } from "../shared/stream.js";
import { hasCursorTrustBypassArg } from "../shared/trust.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveCursorBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "CURSOR_API_KEY") || hasNonEmptyEnvValue(env, "OPENAI_API_KEY")
    ? "api"
    : "subscription";
}

function resolveCursorBiller(
  env: Record<string, string>,
  billingType: "api" | "subscription",
  provider: string | null,
): string {
  const openAiCompatibleBiller = inferOpenAiCompatibleBiller(env, null);
  if (openAiCompatibleBiller === "openrouter") return "openrouter";
  if (billingType === "subscription") return "cursor";
  return provider ?? "cursor";
}

function resolveProviderFromModel(model: string): string | null {
  const trimmed = model.trim().toLowerCase();
  if (!trimmed) return null;
  const slash = trimmed.indexOf("/");
  if (slash > 0) return trimmed.slice(0, slash);
  if (trimmed.includes("sonnet") || trimmed.includes("claude")) return "anthropic";
  if (trimmed.startsWith("gpt") || trimmed.startsWith("o")) return "openai";
  return null;
}

function normalizeMode(rawMode: string): "plan" | "ask" | null {
  const mode = rawMode.trim().toLowerCase();
  if (mode === "plan" || mode === "ask") return mode;
  return null;
}

function renderPaperclipEnvNote(env: Record<string, string>): string {
  const paperclipKeys = Object.keys(env)
    .filter((key) => key.startsWith("PAPERCLIP_"))
    .sort();
  if (paperclipKeys.length === 0) return "";
  return [
    "Paperclip runtime note:",
    `The following PAPERCLIP_* environment variables are available in this run: ${paperclipKeys.join(", ")}`,
    "Do not assume these variables are missing without checking your shell environment.",
    "",
    "",
  ].join("\n");
}

function cursorSkillsHome(): string {
  return path.join(os.homedir(), ".cursor", "skills");
}

type EnsureCursorSkillsInjectedOptions = {
  skillsDir?: string | null;
  skillsEntries?: Array<{ key: string; runtimeName: string; source: string }>;
  skillsHome?: string;
  linkSkill?: (source: string, target: string) => Promise<void>;
};

export async function ensureCursorSkillsInjected(
  onLog: AdapterExecutionContext["onLog"],
  options: EnsureCursorSkillsInjectedOptions = {},
) {
  const skillsEntries = options.skillsEntries
    ?? (options.skillsDir
      ? (await fs.readdir(options.skillsDir, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => ({
            key: entry.name,
            runtimeName: entry.name,
            source: path.join(options.skillsDir!, entry.name),
          }))
      : await readPaperclipRuntimeSkillEntries({}, __moduleDir));
  if (skillsEntries.length === 0) return;

  const skillsHome = options.skillsHome ?? cursorSkillsHome();
  try {
    await fs.mkdir(skillsHome, { recursive: true });
  } catch (err) {
    await onLog(
      "stderr",
      `[paperclip] Failed to prepare Cursor skills directory ${skillsHome}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return;
  }
  const removedSkills = await removeMaintainerOnlySkillSymlinks(
    skillsHome,
    skillsEntries.map((entry) => entry.runtimeName),
  );
  for (const skillName of removedSkills) {
    await onLog(
      "stderr",
      `[paperclip] Removed maintainer-only Cursor skill "${skillName}" from ${skillsHome}\n`,
    );
  }
  const linkSkill = options.linkSkill ?? ((source: string, target: string) => fs.symlink(source, target));
  for (const entry of skillsEntries) {
    const target = path.join(skillsHome, entry.runtimeName);
    try {
      const result = await ensurePaperclipSkillSymlink(entry.source, target, linkSkill);
      if (result === "skipped") continue;

      await onLog(
        "stderr",
        `[paperclip] ${result === "repaired" ? "Repaired" : "Injected"} Cursor skill "${entry.key}" into ${skillsHome}\n`,
      );
    } catch (err) {
      await onLog(
        "stderr",
        `[paperclip] Failed to inject Cursor skill "${entry.key}" into ${skillsHome}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const command = asString(config.command, "agent");
  const model = asString(config.model, DEFAULT_CURSOR_LOCAL_MODEL).trim();
  const mode = normalizeMode(asString(config.mode, ""));

  // Smart model routing config
  const smartRouting = parseObject(config.smartModelRouting);
  const routingEnabled = asBoolean(smartRouting.enabled, false);
  const cheapModel = asString(smartRouting.cheapModel, "");
  const cheapThinkingEffort = asString(smartRouting.cheapThinkingEffort, "");
  const maxPreflightTurns = asNumber(smartRouting.maxPreflightTurns, 2);
  const allowPreflightProgressComment = asBoolean(smartRouting.allowInitialProgressComment, false);

  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const agentHome = asString(workspaceContext.agentHome, "");
  const workspaceHints = Array.isArray(context.paperclipWorkspaces)
    ? context.paperclipWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  const cursorSkillEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredCursorSkillNames = resolvePaperclipDesiredSkillNames(config, cursorSkillEntries);
  await ensureCursorSkillsInjected(onLog, {
    skillsEntries: cursorSkillEntries.filter((entry) => desiredCursorSkillNames.includes(entry.key)),
  });

  const envConfig = parseObject(config.env);
  const hasExplicitApiKey =
    typeof envConfig.PAPERCLIP_API_KEY === "string" && envConfig.PAPERCLIP_API_KEY.trim().length > 0;
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
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
  const wakePayloadJson = stringifyPaperclipWakePayload(context.paperclipWake);
  if (wakeTaskId) {
    env.PAPERCLIP_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.PAPERCLIP_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.PAPERCLIP_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (wakePayloadJson) {
    env.PAPERCLIP_WAKE_PAYLOAD_JSON = wakePayloadJson;
  }
  if (effectiveWorkspaceCwd) {
    env.PAPERCLIP_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.PAPERCLIP_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceId) {
    env.PAPERCLIP_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.PAPERCLIP_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.PAPERCLIP_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  if (agentHome) {
    env.AGENT_HOME = agentHome;
  }
  if (workspaceHints.length > 0) {
    env.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  if (!hasExplicitApiKey && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }
  const effectiveEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const billingType = resolveCursorBillingType(effectiveEnv);
  const runtimeEnv = ensurePathInEnv(effectiveEnv);
  await ensureCommandResolvable(command, cwd, runtimeEnv);
  const resolvedCommand = await resolveCommandForLogs(command, cwd, runtimeEnv);
  const loggedEnv = buildInvocationEnvForLogs(env, {
    runtimeEnv,
    includeRuntimeKeys: ["HOME"],
    resolvedCommand,
  });

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();
  const autoTrustEnabled = !hasCursorTrustBypassArg(extraArgs);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;
  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stdout",
      `[paperclip] Cursor session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  // ---------------------------------------------------------------------------
  // Smart model routing: cheap preflight phase
  // ---------------------------------------------------------------------------
  const shouldRunPreflight =
    routingEnabled &&
    cheapModel.length > 0 &&
    !sessionId &&
    Boolean(wakeTaskId);

  let preflightSegment: ExecutionSegment | null = null;
  let preflightHandoffNote = "";

  if (shouldRunPreflight) {
    const wakePromptForPreflight = renderPaperclipWakePrompt(context.paperclipWake, { resumedSession: false });
    const preflightPromptSections = [
      PREFLIGHT_ORCHESTRATION_PROMPT,
      wakePromptForPreflight,
      ...(allowPreflightProgressComment
        ? []
        : ["Do NOT post comments, leave status updates, or call the Paperclip API."]),
    ];
    const preflightPrompt = joinPromptSections(preflightPromptSections);

    // Cursor preflight: use -p with stdin, --yolo for trust bypass, no --resume
    const preflightArgs: string[] = ["-p", "--output-format", "stream-json", "--workspace", cwd];
    preflightArgs.push("--model", cheapModel);
    if (autoTrustEnabled) preflightArgs.push("--yolo");

    await onLog("stdout", `[paperclip] Smart routing: running cheap preflight with model "${cheapModel}"...\n`);
    if (onMeta) {
      await onMeta({
        adapterType: "cursor",
        command: resolvedCommand,
        cwd,
        commandNotes: ["Smart model routing: cheap preflight phase"],
        commandArgs: preflightArgs,
        env: loggedEnv,
        prompt: preflightPrompt,
        promptMetrics: { promptChars: preflightPrompt.length },
        context,
      });
    }

    const preflightTimeoutSec = timeoutSec > 0 ? Math.min(timeoutSec, 120) : 120;

    try {
      let preflightStdoutLineBuffer = "";
      const emitPreflightNormalizedLine = async (rawLine: string) => {
        const normalized = normalizeCursorStreamLine(rawLine);
        if (!normalized.line) return;
        await onLog(normalized.stream ?? "stdout", `${normalized.line}\n`);
      };
      const flushPreflightChunk = async (chunk: string, finalize = false) => {
        const combined = `${preflightStdoutLineBuffer}${chunk}`;
        const lines = combined.split(/\r?\n/);
        preflightStdoutLineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          await emitPreflightNormalizedLine(line);
        }
        if (finalize) {
          const trailing = preflightStdoutLineBuffer.trim();
          preflightStdoutLineBuffer = "";
          if (trailing) await emitPreflightNormalizedLine(trailing);
        }
      };

      const preflightProc = await runChildProcess(runId, command, preflightArgs, {
        cwd,
        env,
        stdin: preflightPrompt,
        timeoutSec: preflightTimeoutSec,
        graceSec,
        onSpawn,
        onLog: async (stream, chunk) => {
          if (stream !== "stdout") { await onLog(stream, chunk); return; }
          await flushPreflightChunk(chunk);
        },
      });
      await flushPreflightChunk("", true);

      const preflightParsed = parseCursorJsonl(preflightProc.stdout);
      const preflightOk = (preflightProc.exitCode ?? 0) === 0 && !preflightProc.timedOut;

      const preflightProvider = resolveProviderFromModel(cheapModel);
      preflightSegment = {
        phase: "cheap_preflight",
        provider: preflightProvider,
        biller: resolveCursorBiller(effectiveEnv, billingType, preflightProvider),
        model: cheapModel,
        billingType,
        usage: preflightParsed.usage,
        costUsd: preflightParsed.costUsd ?? null,
        summary: preflightOk ? (preflightParsed.summary || null) : null,
      };

      if (preflightOk && preflightParsed.summary) {
        preflightHandoffNote = `## Preflight Summary (from ${cheapModel})\n\n${extractHandoffSection(preflightParsed.summary)}`;
        await onLog("stdout", `[paperclip] Preflight complete. Proceeding with primary model "${model}".\n`);
      } else {
        const reason = preflightProc.timedOut
          ? "timed out"
          : (preflightParsed.errorMessage || `exit code ${preflightProc.exitCode}`);
        await onLog("stdout", `[paperclip] Preflight did not produce a handoff (${reason}). Continuing with primary model only.\n`);
      }
    } catch (err) {
      await onLog("stderr", `[paperclip] Preflight failed: ${err instanceof Error ? err.message : String(err)}. Continuing with primary model only.\n`);
    }
  }

  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const instructionsDir = instructionsFilePath ? `${path.dirname(instructionsFilePath)}/` : "";
  let instructionsPrefix = "";
  let instructionsChars = 0;
  if (instructionsFilePath) {
    try {
      const instructionsContents = await fs.readFile(instructionsFilePath, "utf8");
      instructionsPrefix =
        `${instructionsContents}\n\n` +
        `The above agent instructions were loaded from ${instructionsFilePath}. ` +
        `Resolve any relative file references from ${instructionsDir}.\n\n`;
      instructionsChars = instructionsPrefix.length;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stdout",
        `[paperclip] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}\n`,
      );
    }
  }
  const commandNotes = (() => {
    const notes: string[] = [];
    if (autoTrustEnabled) {
      notes.push("Auto-added --yolo to bypass interactive prompts.");
    }
    notes.push("Prompt is piped to Cursor via stdin.");
    if (!instructionsFilePath) return notes;
    if (instructionsPrefix.length > 0) {
      notes.push(
        `Loaded agent instructions from ${instructionsFilePath}`,
        `Prepended instructions + path directive to prompt (relative references from ${instructionsDir}).`,
      );
      return notes;
    }
    notes.push(
      `Configured instructionsFilePath ${instructionsFilePath}, but file could not be read; continuing without injected instructions.`,
    );
    return notes;
  })();

  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedBootstrapPrompt =
    !sessionId && bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, { resumedSession: Boolean(sessionId) });
  const shouldUseResumeDeltaPrompt = Boolean(sessionId) && wakePrompt.length > 0;
  const renderedPrompt = shouldUseResumeDeltaPrompt ? "" : renderTemplate(promptTemplate, templateData);
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const paperclipEnvNote = renderPaperclipEnvNote(env);
  const prompt = joinPromptSections([
    instructionsPrefix,
    renderedBootstrapPrompt,
    wakePrompt,
    sessionHandoffNote,
    preflightHandoffNote,
    paperclipEnvNote,
    renderedPrompt,
  ]);
  const promptMetrics = {
    promptChars: prompt.length,
    instructionsChars,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    wakePromptChars: wakePrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    preflightHandoffChars: preflightHandoffNote.length,
    runtimeNoteChars: paperclipEnvNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const buildArgs = (resumeSessionId: string | null) => {
    const args = ["-p", "--output-format", "stream-json", "--workspace", cwd];
    if (resumeSessionId) args.push("--resume", resumeSessionId);
    if (model) args.push("--model", model);
    if (mode) args.push("--mode", mode);
    if (autoTrustEnabled) args.push("--yolo");
    if (extraArgs.length > 0) args.push(...extraArgs);
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "cursor",
        command: resolvedCommand,
        cwd,
        commandNotes,
        commandArgs: args,
        env: loggedEnv,
        prompt,
        promptMetrics,
        context,
      });
    }

    let stdoutLineBuffer = "";
    const emitNormalizedStdoutLine = async (rawLine: string) => {
      const normalized = normalizeCursorStreamLine(rawLine);
      if (!normalized.line) return;
      await onLog(normalized.stream ?? "stdout", `${normalized.line}\n`);
    };
    const flushStdoutChunk = async (chunk: string, finalize = false) => {
      const combined = `${stdoutLineBuffer}${chunk}`;
      const lines = combined.split(/\r?\n/);
      stdoutLineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        await emitNormalizedStdoutLine(line);
      }

      if (finalize) {
        const trailing = stdoutLineBuffer.trim();
        stdoutLineBuffer = "";
        if (trailing) {
          await emitNormalizedStdoutLine(trailing);
        }
      }
    };

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      timeoutSec,
      graceSec,
      stdin: prompt,
      onSpawn,
      onLog: async (stream, chunk) => {
        if (stream !== "stdout") {
          await onLog(stream, chunk);
          return;
        }
        await flushStdoutChunk(chunk);
      },
    });
    await flushStdoutChunk("", true);

    return {
      proc,
      parsed: parseCursorJsonl(proc.stdout),
    };
  };

  const providerFromModel = resolveProviderFromModel(model);

  const toResult = (
    attempt: {
      proc: {
        exitCode: number | null;
        signal: string | null;
        timedOut: boolean;
        stdout: string;
        stderr: string;
      };
      parsed: ReturnType<typeof parseCursorJsonl>;
    },
    clearSessionOnMissingSession = false,
  ): AdapterExecutionResult => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        clearSession: clearSessionOnMissingSession,
      };
    }

    const resolvedSessionId = attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const resolvedSessionParams = resolvedSessionId
      ? ({
          sessionId: resolvedSessionId,
          cwd,
          ...(workspaceId ? { workspaceId } : {}),
          ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
          ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
        } as Record<string, unknown>)
      : null;
    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const fallbackErrorMessage =
      parsedError ||
      stderrLine ||
      `Cursor exited with code ${attempt.proc.exitCode ?? -1}`;

    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage:
        (attempt.proc.exitCode ?? 0) === 0
          ? null
          : fallbackErrorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: providerFromModel,
      biller: resolveCursorBiller(effectiveEnv, billingType, providerFromModel),
      model,
      billingType,
      costUsd: attempt.parsed.costUsd,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
      },
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissingSession && !resolvedSessionId),
    };
  };

  const initial = await runAttempt(sessionId);
  if (
    sessionId &&
    !initial.proc.timedOut &&
    (initial.proc.exitCode ?? 0) !== 0 &&
    isCursorUnknownSessionError(initial.proc.stdout, initial.proc.stderr)
  ) {
    await onLog(
      "stdout",
      `[paperclip] Cursor resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
    );
    const retry = await runAttempt(null);
    const retryResult = toResult(retry, true);
    if (preflightSegment) {
      retryResult.executionSegments = [
        preflightSegment,
        {
          phase: "primary",
          provider: retryResult.provider ?? null,
          biller: retryResult.biller ?? null,
          model: retryResult.model ?? null,
          billingType: retryResult.billingType ?? null,
          usage: retryResult.usage,
          costUsd: retryResult.costUsd ?? null,
          summary: retryResult.summary ?? null,
        },
      ];
    }
    return retryResult;
  }

  const finalResult = toResult(initial);

  if (preflightSegment) {
    finalResult.executionSegments = [
      preflightSegment,
      {
        phase: "primary",
        provider: finalResult.provider ?? null,
        biller: finalResult.biller ?? null,
        model: finalResult.model ?? null,
        billingType: finalResult.billingType ?? null,
        usage: finalResult.usage,
        costUsd: finalResult.costUsd ?? null,
        summary: finalResult.summary ?? null,
      },
    ];
  }

  return finalResult;
}
