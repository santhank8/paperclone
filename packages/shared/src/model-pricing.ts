// Prices in cents per 1M tokens. Keep in sync with provider pricing pages.
// Used for approximate cost display on subscription-billed runs (billingType === "subscription_included").
// These are NOT used for billing — they are display-only estimates.

export interface ModelPricing {
  /** Cost in cents per 1 million input tokens */
  input: number;
  /** Cost in cents per 1 million output tokens */
  output: number;
  /** Cost in cents per 1 million cache-read (cached input) tokens */
  cacheRead: number;
}

/**
 * Model pricing table keyed by "provider/model".
 * Prices in cents per 1M tokens.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude — https://www.anthropic.com/pricing
  "anthropic/claude-opus-4-5": { input: 1500, output: 7500, cacheRead: 150 },
  "anthropic/claude-sonnet-4-5": { input: 300, output: 1500, cacheRead: 30 },
  "anthropic/claude-haiku-3-5": { input: 80, output: 400, cacheRead: 8 },
  "anthropic/claude-haiku-4-5": { input: 80, output: 400, cacheRead: 8 },
  "anthropic/claude-3-7-sonnet-20250219": { input: 300, output: 1500, cacheRead: 30 },
  "anthropic/claude-3-7-sonnet-latest": { input: 300, output: 1500, cacheRead: 30 },
  "anthropic/claude-3-5-sonnet-20241022": { input: 300, output: 1500, cacheRead: 30 },
  "anthropic/claude-3-5-sonnet-latest": { input: 300, output: 1500, cacheRead: 30 },
  "anthropic/claude-3-5-haiku-20241022": { input: 80, output: 400, cacheRead: 8 },
  "anthropic/claude-3-5-haiku-latest": { input: 80, output: 400, cacheRead: 8 },
  "anthropic/claude-3-opus-20240229": { input: 1500, output: 7500, cacheRead: 150 },
  "anthropic/claude-3-haiku-20240307": { input: 25, output: 125, cacheRead: 3 },
  // Also handle without provider prefix (some adapters may emit model only)
  "claude-opus-4-5": { input: 1500, output: 7500, cacheRead: 150 },
  "claude-sonnet-4-5": { input: 300, output: 1500, cacheRead: 30 },
  "claude-haiku-3-5": { input: 80, output: 400, cacheRead: 8 },
  "claude-haiku-4-5": { input: 80, output: 400, cacheRead: 8 },
  "claude-3-7-sonnet-20250219": { input: 300, output: 1500, cacheRead: 30 },
  "claude-3-7-sonnet-latest": { input: 300, output: 1500, cacheRead: 30 },
  "claude-3-5-sonnet-20241022": { input: 300, output: 1500, cacheRead: 30 },
  "claude-3-5-sonnet-latest": { input: 300, output: 1500, cacheRead: 30 },
  "claude-3-5-haiku-20241022": { input: 80, output: 400, cacheRead: 8 },
  "claude-3-5-haiku-latest": { input: 80, output: 400, cacheRead: 8 },
  "claude-3-opus-20240229": { input: 1500, output: 7500, cacheRead: 150 },
  "claude-3-haiku-20240307": { input: 25, output: 125, cacheRead: 3 },

  // OpenAI / Codex — https://openai.com/pricing
  "openai/gpt-4o": { input: 250, output: 1000, cacheRead: 125 },
  "openai/gpt-4o-mini": { input: 15, output: 60, cacheRead: 8 },
  "openai/o1": { input: 1500, output: 6000, cacheRead: 750 },
  "openai/o1-mini": { input: 110, output: 440, cacheRead: 55 },
  "openai/o3": { input: 1000, output: 4000, cacheRead: 250 },
  "openai/o3-mini": { input: 110, output: 440, cacheRead: 55 },
  "openai/o4-mini": { input: 110, output: 440, cacheRead: 55 },
  "openai/codex-mini-latest": { input: 150, output: 600, cacheRead: 38 },
  // Also without provider prefix
  "gpt-4o": { input: 250, output: 1000, cacheRead: 125 },
  "gpt-4o-mini": { input: 15, output: 60, cacheRead: 8 },
  "o1": { input: 1500, output: 6000, cacheRead: 750 },
  "o1-mini": { input: 110, output: 440, cacheRead: 55 },
  "o3": { input: 1000, output: 4000, cacheRead: 250 },
  "o3-mini": { input: 110, output: 440, cacheRead: 55 },
  "o4-mini": { input: 110, output: 440, cacheRead: 55 },
  "codex-mini-latest": { input: 150, output: 600, cacheRead: 38 },

  // Google Gemini — https://ai.google.dev/pricing
  "google/gemini-2.5-pro": { input: 125, output: 1000, cacheRead: 31 },
  "google/gemini-2.5-flash": { input: 15, output: 60, cacheRead: 4 },
  "google/gemini-2.0-flash": { input: 10, output: 40, cacheRead: 3 },
  "google/gemini-1.5-pro": { input: 125, output: 500, cacheRead: 31 },
  "google/gemini-1.5-flash": { input: 8, output: 30, cacheRead: 2 },
  "google/gemini-1.5-flash-8b": { input: 4, output: 15, cacheRead: 1 },
  // Also without provider prefix
  "gemini-2.5-pro": { input: 125, output: 1000, cacheRead: 31 },
  "gemini-2.5-flash": { input: 15, output: 60, cacheRead: 4 },
  "gemini-2.0-flash": { input: 10, output: 40, cacheRead: 3 },
  "gemini-1.5-pro": { input: 125, output: 500, cacheRead: 31 },
  "gemini-1.5-flash": { input: 8, output: 30, cacheRead: 2 },
  "gemini-1.5-flash-8b": { input: 4, output: 15, cacheRead: 1 },

  // GitHub Copilot gateway — routes to Claude Sonnet
  "github-copilot/claude-sonnet-4.6": { input: 300, output: 1500, cacheRead: 30 },
  "github-copilot/github-copilot/claude-sonnet-4.6": { input: 300, output: 1500, cacheRead: 30 },
};

/**
 * Compute an approximate cost in cents from token counts and model pricing.
 *
 * Returns 0 if the model is not in the pricing table (unknown model).
 * The result is for display purposes only — not for billing.
 *
 * @param provider  Provider string (e.g. "anthropic", "openai", "google"). Pass empty string if unknown.
 * @param model     Model id string (e.g. "claude-3-5-sonnet-20241022", "gpt-4o")
 * @param inputTokens  Non-cached input tokens
 * @param outputTokens  Output tokens
 * @param cachedInputTokens  Cache-read (cached input) tokens
 */
export function computeTokenCostCents(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
): number {
  // Try "provider/model" first, then model alone as fallback
  const pricing =
    (provider ? MODEL_PRICING[`${provider}/${model}`] : undefined) ??
    MODEL_PRICING[model];
  if (!pricing) return 0;
  return Math.max(
    0,
    Math.round(
      (inputTokens * pricing.input +
        outputTokens * pricing.output +
        cachedInputTokens * pricing.cacheRead) /
        1_000_000,
    ),
  );
}

/**
 * Compute an approximate cost in USD from token counts and model pricing.
 * Returns null if the model is not in the pricing table.
 */
export function computeTokenCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
): number | null {
  const pricing =
    (provider ? MODEL_PRICING[`${provider}/${model}`] : undefined) ??
    MODEL_PRICING[model];
  if (!pricing) return null;
  return (
    (inputTokens * pricing.input +
      outputTokens * pricing.output +
      cachedInputTokens * pricing.cacheRead) /
    1_000_000 /
    100
  );
}
