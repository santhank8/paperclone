import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";
import { testOpenAiCompatApiKey } from "@paperclipai/adapter-utils";
import { DEFAULT_DEEPSEEK_LOCAL_MODEL, DEFAULT_DEEPSEEK_BASE_URL } from "../index.js";

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

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const env = ctx.config.env as Record<string, unknown> | undefined;
  const apiKey = resolveEnvValue(env, "DEEPSEEK_API_KEY") || process.env.DEEPSEEK_API_KEY || "";
  const model = (typeof ctx.config.model === "string" && ctx.config.model) || DEFAULT_DEEPSEEK_LOCAL_MODEL;
  const baseUrl = (typeof ctx.config.baseUrl === "string" && ctx.config.baseUrl) || DEFAULT_DEEPSEEK_BASE_URL;

  return testOpenAiCompatApiKey(baseUrl, apiKey, model, "deepseek_local", "DEEPSEEK_API_KEY");
}
