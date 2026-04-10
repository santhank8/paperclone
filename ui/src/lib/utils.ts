import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deriveAgentUrlKey, deriveProjectUrlKey, normalizeProjectUrlKey, hasNonAsciiContent } from "@paperclipai/shared";
import type { BillingType, FinanceDirection, FinanceEventKind } from "@paperclipai/shared";
import { readStoredUiLanguage } from "./ui-language";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getUiLocale(): string {
  return readStoredUiLanguage() === "zh-CN" ? "zh-CN" : "en-US";
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(getUiLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(getUiLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleString(getUiLocale(), {
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);
  const locale = getUiLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffSec < 60) return locale === "zh-CN" ? "刚刚" : "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
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
    aws_bedrock: "AWS Bedrock",
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
  const zh = readStoredUiLanguage() === "zh-CN";
  const map: Record<BillingType, string> = zh
    ? {
        metered_api: "按量 API",
        subscription_included: "订阅额度",
        subscription_overage: "订阅超额",
        credits: "积分",
        fixed: "固定费用",
        unknown: "未知",
      }
    : {
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
  const zh = readStoredUiLanguage() === "zh-CN";
  const map: Record<string, string> = zh
    ? {
        "anthropic-oauth": "Anthropic OAuth",
        "claude-cli": "Claude CLI",
        "bedrock": "AWS Bedrock",
        "codex-rpc": "Codex 应用服务",
        "codex-wham": "ChatGPT WHAM",
      }
    : {
        "anthropic-oauth": "Anthropic OAuth",
        "claude-cli": "Claude CLI",
        "bedrock": "AWS Bedrock",
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

export function visibleRunCostUsd(
  usage: Record<string, unknown> | null,
  result: Record<string, unknown> | null = null,
): number {
  const billingType = coerceBillingType(usage?.billingType) ?? coerceBillingType(result?.billingType);
  if (billingType === "subscription_included") return 0;
  return readRunCostUsd(usage) || readRunCostUsd(result);
}

export function financeEventKindDisplayName(eventKind: FinanceEventKind): string {
  const zh = readStoredUiLanguage() === "zh-CN";
  const map: Record<FinanceEventKind, string> = zh
    ? {
        inference_charge: "推理费用",
        platform_fee: "平台费用",
        credit_purchase: "积分购买",
        credit_refund: "积分退款",
        credit_expiry: "积分过期",
        byok_fee: "BYOK 费用",
        gateway_overhead: "网关附加费用",
        log_storage_charge: "日志存储",
        logpush_charge: "日志推送",
        provisioned_capacity_charge: "预置容量",
        training_charge: "训练费用",
        custom_model_import_charge: "自定义模型导入",
        custom_model_storage_charge: "自定义模型存储",
        manual_adjustment: "手动调整",
      }
    : {
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
  return readStoredUiLanguage() === "zh-CN"
    ? (direction === "credit" ? "入账" : "支出")
    : (direction === "credit" ? "Credit" : "Debit");
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

/** Build a project route reference, falling back to UUID when the derived key is ambiguous. */
export function projectRouteRef(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  const key = project.urlKey ?? deriveProjectUrlKey(project.name, project.id);
  // Guard for rolling deploys or legacy data where the server returned a bare slug without UUID suffix.
  if (key === normalizeProjectUrlKey(project.name) && hasNonAsciiContent(project.name)) return project.id;
  return key;
}

/** Build a project URL using the short URL key when available. */
export function projectUrl(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/projects/${projectRouteRef(project)}`;
}

/** Build a project workspace URL scoped under its project. */
export function projectWorkspaceUrl(
  project: { id: string; urlKey?: string | null; name?: string | null },
  workspaceId: string,
): string {
  return `${projectUrl(project)}/workspaces/${workspaceId}`;
}
