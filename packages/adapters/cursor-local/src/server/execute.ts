import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asBoolean,
  asNumber,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { parseCursorJsonl, isCursorUnknownSessionError } from "./parse.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** Prompt is passed as CLI arg (-p); very long prompts may hit OS ARG_MAX. Warn above this size. */
const PROMPT_ARG_MAX_WARN_BYTES = 500 * 1024;
const PAPERCLIP_SKILLS_CANDIDATES = [
  path.resolve(__moduleDir, "../../skills"), // published: <pkg>/dist/server/ -> <pkg>/skills/
  path.resolve(__moduleDir, "../../../../../skills"), // dev: src/server/ -> repo root/skills/
];

function cursorHomeDir(): string {
  const fromEnv = process.env.CURSOR_HOME;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  return path.join(os.homedir(), ".cursor");
}

async function resolvePaperclipSkillsDir(): Promise<string | null> {
  for (const candidate of PAPERCLIP_SKILLS_CANDIDATES) {
    const isDir = await fs.stat(candidate).then((s) => s.isDirectory()).catch(() => false);
    if (isDir) return candidate;
  }
  return null;
}

async function ensureCursorSkillsInjected(onLog: AdapterExecutionContext["onLog"]) {
  const skillsDir = await resolvePaperclipSkillsDir();
  if (!skillsDir) return;

  try {
    const skillsHome = path.join(cursorHomeDir(), "skills");
    await fs.mkdir(skillsHome, { recursive: true });
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const source = path.join(skillsDir, entry.name);
      const target = path.join(skillsHome, entry.name);
      const existing = await fs.lstat(target).catch(() => null);
      if (existing) continue;

      try {
        await fs.symlink(source, target);
        await onLog(
          "stderr",
          `[paperclip] Injected Cursor skill "${entry.name}" into ${skillsHome}\n`,
        );
      } catch (err) {
        await onLog(
          "stderr",
          `[paperclip] Failed to inject Cursor skill "${entry.name}": ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }
  } catch (err) {
    await onLog(
      "stderr",
      `[paperclip] Skills injection skipped: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const command = asString(config.command, "agent");
  const cwdRaw = asString(config.cwd, "");
  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const cwd = cwdRaw || workspaceCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  await ensureCursorSkillsInjected(onLog);

  const model = asString(config.model, "").trim();
  const outputFormat = asString(config.outputFormat, "stream-json");
  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  // Default true for headless: avoids "Workspace Trust Required" prompt; user can disable in adapter config
  const trust = asBoolean(config.trust, true);
  const force = asBoolean(config.force, true);
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  if (typeof context.taskId === "string" && context.taskId.trim()) {
    env.PAPERCLIP_TASK_ID = context.taskId.trim();
  }
  if (typeof context.issueId === "string" && context.issueId.trim()) {
    env.PAPERCLIP_TASK_ID = env.PAPERCLIP_TASK_ID || context.issueId.trim();
  }
  if (typeof context.wakeReason === "string" && context.wakeReason.trim()) {
    env.PAPERCLIP_WAKE_REASON = context.wakeReason.trim();
  }
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const extraArgs = asStringArray(config.extraArgs);
  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId =
    asString(runtimeSessionParams.session_id, asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "")) ?? "";
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResume =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResume ? runtimeSessionId : null;

  let instructionsPrefix = "";
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  if (instructionsFilePath) {
    try {
      const contents = await fs.readFile(instructionsFilePath, "utf8");
      instructionsPrefix = `${contents}\n\n`;
      await onLog("stderr", `[paperclip] Loaded agent instructions: ${instructionsFilePath}\n`);
    } catch (err) {
      await onLog(
        "stderr",
        `[paperclip] Warning: could not read instructions file "${instructionsFilePath}": ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  const renderedPrompt =
    instructionsPrefix +
    renderTemplate(promptTemplate, {
      agentId: agent.id,
      companyId: agent.companyId,
      runId,
      company: { id: agent.companyId },
      agent,
      run: { id: runId, source: "on_demand" },
      context,
    });

  if (renderedPrompt.length > PROMPT_ARG_MAX_WARN_BYTES) {
    await onLog(
      "stderr",
      `[paperclip] Warning: prompt is ${renderedPrompt.length} bytes; very long prompts passed as CLI args may hit OS ARG_MAX and fail.\n`,
    );
  }

  const buildArgs = (resumeSessionId: string | null) => {
    const args = ["-p", renderedPrompt, "--output-format", outputFormat, "--workspace", cwd];
    if (model) args.push("--model", model);
    if (trust) args.push("--trust");
    if (force) args.push("--force");
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push(`--resume=${resumeSessionId}`);
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "cursor_local",
        command,
        cwd,
        commandNotes: [],
        commandArgs: args.map((value, idx) => (idx === 1 ? `<prompt ${renderedPrompt.length} chars>` : value)),
        env: redactEnvForLogs(env),
        prompt: renderedPrompt,
        context,
      });
    }

    const effectiveTimeoutSec = timeoutSec;
    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      timeoutSec: effectiveTimeoutSec,
      graceSec,
      onLog,
    });

    return {
      proc,
      parsed: parseCursorJsonl(proc.stdout),
      effectiveTimeoutSec,
    };
  };

  const toResult = (
    attempt: {
      proc: { exitCode: number | null; signal: string | null; timedOut: boolean; stdout: string; stderr: string };
      parsed: ReturnType<typeof parseCursorJsonl>;
      effectiveTimeoutSec: number;
    },
    clearSessionOnMissing = false,
  ): AdapterExecutionResult => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${attempt.effectiveTimeoutSec}s`,
        clearSession: clearSessionOnMissing,
      };
    }

    const resolvedSessionId =
      attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const sessionParams =
      resolvedSessionId
        ? { session_id: resolvedSessionId, cwd }
        : null;
    const parsedError = (attempt.parsed.errorMessage ?? "").trim();
    const stderrFirst = attempt.proc.stderr.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
    const errorMessage =
      (attempt.proc.exitCode ?? 0) === 0
        ? null
        : parsedError || stderrFirst || `Cursor exited with code ${attempt.proc.exitCode ?? -1}`;

    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "cursor",
      model: model || null,
      costUsd: null,
      resultJson: { stdout: attempt.proc.stdout, stderr: attempt.proc.stderr },
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissing && !resolvedSessionId),
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
      "stderr",
      `[paperclip] Cursor resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
    );
    const retry = await runAttempt(null);
    return toResult(retry, true);
  }
  return toResult(initial);
}
