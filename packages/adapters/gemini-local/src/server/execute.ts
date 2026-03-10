import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import type { RunProcessResult } from "@paperclipai/adapter-utils/server-utils";
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
import {
  parseGeminiStreamJson,
  describeGeminiFailure,
  detectGeminiAuthRequired,
} from "./parse.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

interface GeminiExecutionInput {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  authToken?: string;
}

interface GeminiRuntimeConfig {
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

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveGeminiBillingType(env: Record<string, string>): "api" | "subscription" {
  // Gemini uses API-key auth when GEMINI_API_KEY or GOOGLE_API_KEY is present
  const hasApiKey =
    hasNonEmptyEnvValue(env, "GEMINI_API_KEY") ||
    hasNonEmptyEnvValue(env, "GOOGLE_API_KEY");
  return hasApiKey ? "api" : "subscription";
}

// Token pricing per 1M tokens (as of 2026)
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.10, output: 0.40 },
  "gemini-2.5-pro": { input: 2.00, output: 12.00 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite": { input: 0.10, output: 0.40 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
};

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const prices = PRICING[model] || PRICING["gemini-2.5-flash"];
  const inputCost = (inputTokens / 1_000_000) * prices.input;
  const outputCost = (outputTokens / 1_000_000) * prices.output;
  return inputCost + outputCost;
}

async function buildGeminiRuntimeConfig(input: GeminiExecutionInput): Promise<GeminiRuntimeConfig> {
  const { runId, agent, config, context } = input;

  const command = asString(config.command, "gemini");
  const workspaceContext = parseObject(context.paperclipWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceId = asString(workspaceContext.workspaceId, "") || null;
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "") || null;
  const workspaceRepoRef = asString(workspaceContext.repoRef, "") || null;
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const envConfig = parseObject(config.env);
  const hasExplicitApiKey =
    (typeof envConfig.GEMINI_API_KEY === "string" && envConfig.GEMINI_API_KEY.trim().length > 0) ||
    (typeof envConfig.GOOGLE_API_KEY === "string" && envConfig.GOOGLE_API_KEY.trim().length > 0);
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

  if (wakeTaskId) {
    env.PAPERCLIP_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.PAPERCLIP_WAKE_REASON = wakeReason;
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

  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

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

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const model = asString(config.model, "gemini-2.5-flash");

  const runtimeConfig = await buildGeminiRuntimeConfig({
    runId,
    agent,
    config,
    context,
    authToken,
  });
  const {
    command,
    cwd,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  } = runtimeConfig;
  const billingType = resolveGeminiBillingType(env);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");

  const prompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  });

  const buildGeminiArgs = (resumeSessionId: string | null) => {
    const args = ["-p", prompt, "--output-format", "stream-json"];
    if (resumeSessionId) args.push("--resume", resumeSessionId);
    args.push("--model", model);
    if (extraArgs.length > 0) args.push(...extraArgs);
    return args;
  };

  const parseFallbackErrorMessage = (proc: RunProcessResult) => {
    const stderrLine =
      proc.stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? "";

    if ((proc.exitCode ?? 0) === 0) {
      return "Failed to parse Gemini JSON output";
    }

    return stderrLine
      ? `Gemini exited with code ${proc.exitCode ?? -1}: ${stderrLine}`
      : `Gemini exited with code ${proc.exitCode ?? -1}`;
  };

  const sessionId = runtimeSessionId || null;

  const args = buildGeminiArgs(sessionId);
  if (onMeta) {
    await onMeta({
      adapterType: "gemini_local",
      command,
      cwd,
      commandArgs: args,
      commandNotes: [],
      env: redactEnvForLogs(env),
      prompt,
      context,
    });
  }

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    stdin: prompt,
    timeoutSec,
    graceSec,
    onLog,
  });

  const parsedStream = parseGeminiStreamJson(proc.stdout);
  const parsed = parsedStream.resultJson ?? parseJson(proc.stdout);

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
      errorCode: "timeout",
    };
  }

  if (!parsed) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage: parseFallbackErrorMessage(proc),
      errorCode: null,
      resultJson: {
        stdout: proc.stdout,
        stderr: proc.stderr,
      },
    };
  }

  const authMeta = detectGeminiAuthRequired({
    parsed,
    stdout: proc.stdout,
    stderr: proc.stderr,
  });

  const usage = parsedStream.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
  };

  const costUsd = parsedStream.costUsd ?? calculateCostUsd(model, usage.inputTokens, usage.outputTokens);

  const resolvedSessionId = parsedStream.sessionId || runtimeSessionId;
  const resolvedSessionParams = resolvedSessionId
    ? ({
      sessionId: resolvedSessionId,
      cwd,
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
      ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
    } as Record<string, unknown>)
    : null;

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage:
      (proc.exitCode ?? 0) === 0
        ? null
        : describeGeminiFailure(parsed) ?? `Gemini exited with code ${proc.exitCode ?? -1}`,
    errorCode: authMeta.requiresAuth ? "gemini_auth_required" : null,
    errorMeta: authMeta.requiresAuth ? { loginUrl: authMeta.loginUrl } : undefined,
    usage,
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionParams,
    sessionDisplayId: resolvedSessionId,
    provider: "google",
    model: parsedStream.model || model,
    billingType,
    costUsd,
    resultJson: parsed,
    summary: parsedStream.summary || "",
  };
}