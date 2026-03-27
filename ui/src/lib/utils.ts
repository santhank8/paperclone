import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deriveAgentUrlKey, deriveProjectUrlKey, computeTokenCostUsd } from "@paperclipai/shared";
import type { BillingType, FinanceDirection, FinanceEventKind } from "@paperclipai/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Map a raw provider slug to a display-friendly name. */
export function providerDisplayName(provider: string): string {
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    chatgpt: "ChatGPT",
    google: "Google",
    cursor: "Cursor",
    jetbrains: "JetBrains AI",
  };
  return map[provider.toLowerCase()] ?? provider;
}

export function billingTypeDisplayName(billingType: BillingType): string {
  const map: Record<BillingType, string> = {
    metered_api: "Metered API",
    subscription_included: "Subscription",
    subscription_overage: "Subscription overage",
    credits: "Credits",
    fixed: "Fixed",
    unknown: "Unknown",
  };
  return map[billingType];
}

export function quotaSourceDisplayName(source: string): string {
  const map: Record<string, string> = {
    "anthropic-oauth": "Anthropic OAuth",
    "claude-cli": "Claude CLI",
    "codex-rpc": "Codex app server",
    "codex-wham": "ChatGPT WHAM",
  };
  return map[source] ?? source;
}

function coerceBillingType(value: unknown): BillingType | null {
  if (
    value === "metered_api" ||
    value === "subscription_included" ||
    value === "subscription_overage" ||
    value === "credits" ||
    value === "fixed" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function readRunCostUsd(payload: Record<string, unknown> | null): number {
  if (!payload) return 0;
  for (const key of ["costUsd", "cost_usd", "total_cost_usd"] as const) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function readUsageTokens(usage: Record<string, unknown> | null): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
} {
  if (!usage) return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  function readNum(obj: Record<string, unknown>, ...keys: string[]): number {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    }
    return 0;
  }
  return {
    inputTokens: readNum(usage, "inputTokens", "input_tokens"),
    outputTokens: readNum(usage, "outputTokens", "output_tokens"),
    cachedInputTokens: readNum(usage, "cachedInputTokens", "cached_input_tokens", "cache_read_input_tokens"),
  };
}

/**
 * Returns true when the run was billed as subscription_included.
 * In that case any reported cost is an approximation, not a real charge.
 */
export function isApproximateRunCost(
  usage: Record<string, unknown> | null,
  result: Record<string, unknown> | null = null,
): boolean {
  const billingType = coerceBillingType(usage?.billingType) ?? coerceBillingType(result?.billingType);
  return billingType === "subscription_included";
}

export function visibleRunCostUsd(
  usage: Record<string, unknown> | null,
  result: Record<string, unknown> | null = null,
): number {
  const billingType = coerceBillingType(usage?.billingType) ?? coerceBillingType(result?.billingType);
  if (billingType === "subscription_included") {
    // Prefer adapter-reported costUsd (Claude/Gemini/Cursor report this even on subscription)
    const reported = readRunCostUsd(usage) || readRunCostUsd(result);
    if (reported > 0) return reported;
    // Fall back to token-based estimate (e.g. Codex always returns costUsd: null)
    const provider = typeof usage?.provider === "string" ? usage.provider : "";
    const model = typeof usage?.model === "string" ? usage.model : "";
    if (model) {
      const { inputTokens, outputTokens, cachedInputTokens } = readUsageTokens(usage);
      const estimated = computeTokenCostUsd(provider, model, inputTokens, outputTokens, cachedInputTokens);
      if (estimated !== null) return estimated;
    }
    return 0;
  }
  return readRunCostUsd(usage) || readRunCostUsd(result);
}

export function financeEventKindDisplayName(eventKind: FinanceEventKind): string {
  const map: Record<FinanceEventKind, string> = {
    inference_charge: "Inference charge",
    platform_fee: "Platform fee",
    credit_purchase: "Credit purchase",
    credit_refund: "Credit refund",
    credit_expiry: "Credit expiry",
    byok_fee: "BYOK fee",
    gateway_overhead: "Gateway overhead",
    log_storage_charge: "Log storage",
    logpush_charge: "Logpush",
    provisioned_capacity_charge: "Provisioned capacity",
    training_charge: "Training",
    custom_model_import_charge: "Custom model import",
    custom_model_storage_charge: "Custom model storage",
    manual_adjustment: "Manual adjustment",
  };
  return map[eventKind];
}

export function financeDirectionDisplayName(direction: FinanceDirection): string {
  return direction === "credit" ? "Credit" : "Debit";
}

/** Build an issue URL using the human-readable identifier when available. */
export function issueUrl(issue: { id: string; identifier?: string | null }): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}

/** Build an agent route URL using the short URL key when available. */
export function agentRouteRef(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return agent.urlKey ?? deriveAgentUrlKey(agent.name, agent.id);
}

/** Build an agent URL using the short URL key when available. */
export function agentUrl(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/agents/${agentRouteRef(agent)}`;
}

/** Build a project route reference using the short URL key when available. */
export function projectRouteRef(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return project.urlKey ?? deriveProjectUrlKey(project.name, project.id);
}

/** Build a project URL using the short URL key when available. */
export function projectUrl(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/projects/${projectRouteRef(project)}`;
}
