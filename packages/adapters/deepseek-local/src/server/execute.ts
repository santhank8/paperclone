import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import { executeOpenAiCompatChat } from "@paperclipai/adapter-utils";
import { DEFAULT_DEEPSEEK_LOCAL_MODEL, DEFAULT_DEEPSEEK_BASE_URL } from "../index.js";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback?: number): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function resolveEnvValue(env: Record<string, unknown> | undefined, key: string): string {
  if (!env) return "";
  const entry = env[key];
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
    const rec = entry as Record<string, unknown>;
    if (rec.type === "plain" && typeof rec.value === "string") return rec.value;
  }
  return "";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, context, onLog } = ctx;
  const env = config.env as Record<string, unknown> | undefined;

  const apiKey = resolveEnvValue(env, "DEEPSEEK_API_KEY") || process.env.DEEPSEEK_API_KEY || "";
  const model = asString(config.model, DEFAULT_DEEPSEEK_LOCAL_MODEL);
  const baseUrl = asString(config.baseUrl, DEFAULT_DEEPSEEK_BASE_URL);
  const maxTokens = asNumber(config.maxTokens);
  const temperature = asNumber(config.temperature);

  if (!apiKey) {
    await onLog("stderr", JSON.stringify({ type: "error", error: "DEEPSEEK_API_KEY 未设置" }));
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "DEEPSEEK_API_KEY 未设置",
      provider: "deepseek",
      biller: "deepseek",
      model,
      billingType: "api",
    };
  }

  // Build prompt from context
  const prompt = asString(context.prompt as string) || asString(config.promptTemplate as string, "请完成分配给你的任务。");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  const systemPrompt = asString(context.systemPrompt as string);
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: prompt });

  return executeOpenAiCompatChat(
    { baseUrl, apiKey, model, maxTokens, temperature, provider: "deepseek", biller: "deepseek", adapterType: "deepseek_local" },
    messages,
    { onLog },
  );
}
