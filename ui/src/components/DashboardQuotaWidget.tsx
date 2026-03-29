import { useQuery } from "@tanstack/react-query";
import { costsApi } from "@/api/costs";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router";
import { Gauge, RefreshCw } from "lucide-react";
import type { ProviderQuotaResult, QuotaWindow } from "@paperclipai/shared";

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Shorten window labels for dashboard display */
function shortLabel(window: QuotaWindow, provider: string): string {
  const norm = normalizeLabel(window.label);
  if (norm === "currentsession") return "Daily";
  if (norm.includes("allmodels")) return "Weekly (All)";
  if (norm.includes("sonnetonly") || norm === "currentweeksonnet") return "Weekly (Sonnet)";
  if (norm.includes("opusonly") || norm === "currentweekopus") return "Weekly (Opus)";
  // OpenAI style labels
  if (norm === "5hlimit") return "5h Limit";
  if (norm === "weeklylimit") return "Weekly";
  // Strip model prefix for model-specific rows (e.g. "GPT-5.3-Codex-Spark · 5h limit" → "Codex Spark 5h")
  const modelMatch = window.label.match(/^(.+?)\s*[·]\s*(.+)$/);
  if (modelMatch) {
    const model = modelMatch[1]!.replace(/^GPT-\S+\s*/, "").trim();
    const metric = modelMatch[2]!.trim();
    return model ? `${model} ${metric}` : metric;
  }
  return window.label;
}

function remainingText(window: QuotaWindow): string {
  if (window.usedPercent == null) return "—";
  return `${100 - window.usedPercent}%`;
}

function timeUntilReset(window: QuotaWindow): string | null {
  if (!window.resetsAt) return null;
  const diff = new Date(window.resetsAt).getTime() - Date.now();
  if (diff <= 0) return "resetting...";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fillColor(usedPercent: number | null): string {
  if (usedPercent == null) return "bg-zinc-700";
  if (usedPercent >= 90) return "bg-red-400";
  if (usedPercent >= 70) return "bg-amber-400";
  return "bg-emerald-400";
}

function textColor(usedPercent: number | null): string {
  if (usedPercent == null) return "text-muted-foreground";
  if (usedPercent >= 90) return "text-red-400";
  if (usedPercent >= 70) return "text-amber-400";
  return "text-emerald-400";
}

function providerDisplayName(provider: string): string {
  switch (provider) {
    case "anthropic": return "Claude";
    case "openai": return "OpenAI";
    default: return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

function providerBadge(provider: string): string {
  switch (provider) {
    case "anthropic": return "Max";
    case "openai": return "Codex";
    default: return provider;
  }
}

/** Filter out credit/balance-only windows that aren't useful on dashboard */
function isDashboardRelevant(w: QuotaWindow): boolean {
  if (w.usedPercent == null) return false; // e.g. "Credits: $0.00 remaining", "Extra usage"
  return true;
}

function isRateLimited(error: string | null | undefined): boolean {
  return !!error && error.toLowerCase().includes("rate limit");
}

function ProviderSection({
  result,
}: {
  result: ProviderQuotaResult;
}) {
  const windows = result.ok
    ? result.windows.filter(isDashboardRelevant)
    : [];
  const rateLimited = isRateLimited(result.error);
  const displayName = providerDisplayName(result.provider);
  const badge = providerBadge(result.provider);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {displayName}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 border border-border/50 px-1.5 py-0.5 rounded-sm">
          {badge}
        </span>
      </div>

      {windows.length > 0 ? (
        <div className="space-y-2.5">
          {windows.map((window) => {
            const used = window.usedPercent ?? 0;
            const resetTime = timeUntilReset(window);
            return (
              <div key={window.label}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] font-medium text-foreground">
                    {shortLabel(window, result.provider)}
                  </span>
                  <div className="flex items-center gap-2">
                    {resetTime && (
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        {resetTime}
                      </span>
                    )}
                    <span className={cn("text-[13px] font-semibold tabular-nums", textColor(window.usedPercent))}>
                      {remainingText(window)} left
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      fillColor(window.usedPercent),
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <RefreshCw
            className="h-3 w-3 text-muted-foreground/40 animate-spin"
            style={{ animationDuration: "3s" }}
          />
          <span className="text-[11px] text-muted-foreground/60">
            {rateLimited ? "Rate limited — auto-retry" : "Connecting..."}
          </span>
        </div>
      )}
    </div>
  );
}

interface DashboardQuotaWidgetProps {
  companyId: string;
}

export function DashboardQuotaWidget({ companyId }: DashboardQuotaWidgetProps) {
  const { data: quotaData, isLoading } = useQuery({
    queryKey: queryKeys.usageQuotaWindows(companyId),
    queryFn: () => costsApi.quotaWindows(companyId),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: 1,
  });

  // All providers that either succeeded or at least responded
  const providers = quotaData ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (providers.length === 0) return null;

  return (
    <Link to="/costs" className="no-underline text-inherit block">
      <div className="rounded-lg border border-border p-4 hover:bg-accent/30 transition-colors cursor-pointer">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              API 사용량
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((result) => (
            <ProviderSection key={result.provider} result={result} />
          ))}
        </div>
      </div>
    </Link>
  );
}
