import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { asString, asNumber, renderTemplate, joinPromptSections } from "@paperclipai/adapter-utils/server-utils";
import { execute as claudeExecute } from "@paperclipai/adapter-claude-local/server";
import { isClaudeModel, models as staticModels } from "../index.js";
import { executeLocalModel, resolveBaseUrl } from "./lmstudio.js";

function firstLocalModelId(): string {
  const local = staticModels.find((m) => !isClaudeModel(m.id));
  return local?.id ?? "qwen/qwen3.5-9b";
}

function isClaudeQuotaOrAuthError(result: AdapterExecutionResult): boolean {
  if (result.errorCode === "claude_auth_required") return true;
  if (result.errorMeta && "loginUrl" in result.errorMeta) return true;
  const msg = (result.errorMessage ?? "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota") || msg.includes("not logged in");
}

function isLocalResourceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("out of memory") ||
    lower.includes("gpu") ||
    lower.includes("no model loaded")
  );
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config } = ctx;
  const model = asString(config.model, "");
  const fallbackModel = asString(config.fallbackModel, "");

  if (!model) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No model configured. Set a model in adapterConfig.",
      errorCode: "missing_model",
    };
  }

  if (isClaudeModel(model)) {
    return executeClaudeWithFallback(ctx, model, fallbackModel || firstLocalModelId());
  }

  return executeLocalWithFallback(ctx, model, fallbackModel);
}

/**
 * Primary: Claude CLI. Fallback: local model (on quota/auth error).
 */
async function executeClaudeWithFallback(
  ctx: AdapterExecutionContext,
  _model: string,
  fallbackModel: string,
): Promise<AdapterExecutionResult> {
  const { onLog } = ctx;

  const claudeResult = await claudeExecute(ctx);

  if ((claudeResult.exitCode === 0 && !claudeResult.errorMessage) || !isClaudeQuotaOrAuthError(claudeResult)) {
    return claudeResult;
  }

  if (!fallbackModel) {
    return claudeResult;
  }

  await onLog(
    "stdout",
    `[hybrid] Claude unavailable (${claudeResult.errorCode ?? claudeResult.errorMessage}). Falling back to local model: ${fallbackModel}\n`,
  );

  return executeLocal(ctx, fallbackModel);
}

/**
 * Primary: local OpenAI-compatible endpoint. Fallback: Claude CLI (on connection/resource error).
 */
async function executeLocalWithFallback(
  ctx: AdapterExecutionContext,
  model: string,
  fallbackModel: string,
): Promise<AdapterExecutionResult> {
  const { onLog } = ctx;

  try {
    return await executeLocal(ctx, model);
  } catch (error) {
    if (!fallbackModel || !isClaudeModel(fallbackModel)) {
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = message.toLowerCase().includes("aborted") || message.toLowerCase().includes("timeout");
      return {
        exitCode: 1,
        signal: null,
        timedOut: isTimeout,
        errorMessage: `Local model error: ${message}`,
        errorCode: isTimeout ? "timeout" : "local_error",
        clearSession: true,
      };
    }

    if (!isLocalResourceError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `Local model error: ${message}`,
        errorCode: "local_error",
        clearSession: true,
      };
    }

    await onLog(
      "stdout",
      `[hybrid] Local model unavailable (${error instanceof Error ? error.message : String(error)}). Falling back to Claude: ${fallbackModel}\n`,
    );

    const claudeCtx: AdapterExecutionContext = {
      ...ctx,
      config: { ...ctx.config, model: fallbackModel },
    };
    return claudeExecute(claudeCtx);
  }
}

/**
 * Execute via the local OpenAI-compatible endpoint.
 */
async function executeLocal(
  ctx: AdapterExecutionContext,
  model: string,
): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  const localBaseUrl = resolveBaseUrl(config.localBaseUrl);
  const timeoutSec = asNumber(config.timeoutSec, 300);
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
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

  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrap = bootstrapPromptTemplate.trim().length > 0
    ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
    : "";
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([renderedBootstrap, sessionHandoffNote, renderedPrompt]);

  if (onMeta) {
    await onMeta({
      adapterType: "hybrid_local",
      command: `OpenAI-compatible @ ${localBaseUrl}`,
      cwd: asString(config.cwd, process.cwd()),
      commandArgs: [`model=${model}`],
      prompt,
      context,
    });
  }

  const result = await executeLocalModel({
    baseUrl: localBaseUrl,
    model,
    prompt,
    timeoutMs: timeoutSec * 1000,
    onLog,
  });

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    errorMessage: null,
    usage: result.usage,
    provider: "openai_compatible",
    biller: "local",
    model: result.model,
    billingType: "subscription",
    costUsd: 0,
    summary: result.summary,
    resultJson: {
      result: result.summary,
      model: result.model,
      finish_reason: result.finishReason,
      usage: {
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
      },
    },
    clearSession: true,
  };
}
