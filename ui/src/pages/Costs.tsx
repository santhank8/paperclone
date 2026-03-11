import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CostByProvider } from "@paperclipai/shared";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatCents, formatTokens } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { adapterLabels } from "../components/agent-config-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, DollarSign, Gauge, Layers3 } from "lucide-react";

type DatePreset = "mtd" | "7d" | "30d" | "ytd" | "all" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  mtd: "Month to Date",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom",
};

function computeRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to };
    }
    case "7d": {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString(), to };
    }
    case "all":
      return { from: "", to: "" };
    case "custom":
      return { from: "", to: "" };
  }
}

function formatAdapterLabel(adapterType?: string | null): string {
  if (!adapterType) return "Unknown runtime";
  return adapterLabels[adapterType] ?? adapterType;
}

function formatProviderLabel(provider?: string | null): string {
  switch ((provider ?? "").toLowerCase()) {
    case "anthropic":
      return "Claude";
    case "openai":
      return "Codex";
    default:
      return provider?.trim() || "Unknown";
  }
}

function providerModeLabel(row: Pick<CostByProvider, "provider" | "billingType">): string {
  const provider = formatProviderLabel(row.provider);
  switch (row.billingType) {
    case "api":
      return `${provider} API`;
    case "subscription":
      return `${provider} subscription`;
    default:
      return `${provider} other`;
  }
}

function providerTone(row: Pick<CostByProvider, "provider" | "billingType">): string {
  const provider = (row.provider ?? "").toLowerCase();
  if (provider === "anthropic") {
    return row.billingType === "api"
      ? "border-sky-500/30 bg-sky-500/5"
      : "border-teal-500/30 bg-teal-500/5";
  }
  if (provider === "openai") {
    return row.billingType === "api"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-green-500/30 bg-green-500/5";
  }
  return "border-border bg-card";
}

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [preset, setPreset] = useState<DatePreset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Costs" }]);
  }, [setBreadcrumbs]);

  const { from, to } = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : "",
        to: customTo ? new Date(customTo + "T23:59:59.999Z").toISOString() : "",
      };
    }
    return computeRange(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined),
    queryFn: async () => {
      const [summary, byProvider, byRuntime, byAgent, byProject, windows] = await Promise.all([
        costsApi.summary(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProvider(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byRuntime(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byAgent(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProject(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.windows(selectedCompanyId!),
      ]);
      return { summary, byProvider, byRuntime, byAgent, byProject, windows };
    },
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={DollarSign} message="Select a company to view costs." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="costs" />;
  }

  const presetKeys: DatePreset[] = ["mtd", "7d", "30d", "ytd", "all", "custom"];

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presetKeys.map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</p>
                    <h3 className="text-2xl font-bold">
                      {formatCents(data.summary.spendCents)}{" "}
                      <span className="text-base font-normal text-muted-foreground">
                        {data.summary.budgetCents > 0
                          ? `/ ${formatCents(data.summary.budgetCents)}`
                          : "Unlimited budget"}
                      </span>
                    </h3>
                  </div>
                  {data.summary.budgetCents > 0 && (
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{data.summary.utilizationPercent}% utilized</div>
                      <div>{formatCents(data.summary.budgetCents - data.summary.spendCents)} remaining</div>
                    </div>
                  )}
                </div>
                {data.summary.budgetCents > 0 && (
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                        data.summary.utilizationPercent > 90
                          ? "bg-red-400"
                          : data.summary.utilizationPercent > 70
                            ? "bg-yellow-400"
                            : "bg-green-400"
                      }`}
                      style={{ width: `${Math.min(100, data.summary.utilizationPercent)}%` }}
                    />
                  </div>
                )}
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {data.windows.map((window) => (
                    <div key={window.key} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5" />
                        {window.label}
                      </div>
                      <p className="mt-2 text-lg font-semibold">{formatCents(window.apiSpendCents)}</p>
                      <p className="text-xs text-muted-foreground">
                        API spend
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {window.apiRunCount} API run{window.apiRunCount === 1 ? "" : "s"} |{" "}
                        {window.subscriptionRunCount} subscription run{window.subscriptionRunCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTokens(window.inputTokens)} in / {formatTokens(window.outputTokens)} out tok
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Provider Split</h3>
                  <p className="text-xs text-muted-foreground">
                    API is shown in dollars. Subscription is shown as usage pressure, not billed spend.
                  </p>
                </div>
                <div className="grid gap-3">
                  {data.byProvider.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No provider-attributed usage yet.</p>
                  ) : (
                    data.byProvider.map((row) => (
                      <div
                        key={`${row.provider}:${row.billingType}`}
                        className={`rounded-lg border p-3 ${providerTone(row)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Layers3 className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">{providerModeLabel(row)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {row.runCount} run{row.runCount === 1 ? "" : "s"} · {formatTokens(row.inputTokens)} in /{" "}
                              {formatTokens(row.outputTokens)} out tok
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold">
                              {row.billingType === "api" ? formatCents(row.costCents) : "Usage only"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.models.length} model{row.models.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        {row.models.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {row.models.slice(0, 4).map((model) => (
                              <div
                                key={`${row.provider}:${row.billingType}:${model.model}`}
                                className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                              >
                                <span className="truncate">{model.model}</span>
                                <span className="shrink-0">
                                  {model.runCount} run{model.runCount === 1 ? "" : "s"}
                                  {row.billingType === "api" ? ` · ${formatCents(model.costCents)}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Runtime</h3>
                {data.byRuntime.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runtime-attributed runs yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.byRuntime.map((row) => (
                      <div
                        key={row.adapterType}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{formatAdapterLabel(row.adapterType)}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.totalRunCount} run{row.totalRunCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-medium block">{formatCents(row.apiCostCents)}</span>
                          {row.apiRunCount > 0 && (
                            <span className="text-xs text-muted-foreground block">
                              API: {row.apiRunCount} run{row.apiRunCount === 1 ? "" : "s"} ({formatTokens(row.apiInputTokens)} in / {formatTokens(row.apiOutputTokens)} out tok)
                            </span>
                          )}
                          {row.subscriptionRunCount > 0 && (
                            <span className="text-xs text-muted-foreground block">
                              Local subscription: {row.subscriptionRunCount} run{row.subscriptionRunCount === 1 ? "" : "s"} ({formatTokens(row.subscriptionInputTokens)} in / {formatTokens(row.subscriptionOutputTokens)} out tok)
                            </span>
                          )}
                          {row.unknownRunCount > 0 && (
                            <span className="text-xs text-muted-foreground block">
                              Other: {row.unknownRunCount} run{row.unknownRunCount === 1 ? "" : "s"} ({formatTokens(row.unknownInputTokens)} in / {formatTokens(row.unknownOutputTokens)} out tok)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Project</h3>
                {data.byProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No project-attributed run costs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.byProject.map((row) => (
                      <div
                        key={row.projectId ?? "na"}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {row.projectName ?? row.projectId ?? "Unattributed"}
                        </span>
                        <span className="font-medium">{formatCents(row.costCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">By Agent</h3>
              </div>
              {data.byAgent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agent cost or usage data yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.byAgent.map((row) => (
                    <div
                      key={row.agentId}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Identity
                          name={row.agentName ?? row.agentId}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate">{row.agentName ?? row.agentId}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatAdapterLabel(row.agentAdapterType)}
                          </p>
                        </div>
                        {row.agentStatus === "terminated" && (
                          <StatusBadge status="terminated" />
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-medium block">{formatCents(row.costCents)}</span>
                        {(row.inputTokens > 0 || row.outputTokens > 0) && (
                          <span className="text-xs text-muted-foreground block">
                            Tokens: {formatTokens(row.inputTokens)} in / {formatTokens(row.outputTokens)} out
                          </span>
                        )}
                        {(row.apiRunCount > 0 || row.subscriptionRunCount > 0) && (
                          <span className="text-xs text-muted-foreground block">
                            {row.apiRunCount > 0 ? `API: ${row.apiRunCount}` : null}
                            {row.apiRunCount > 0 && row.subscriptionRunCount > 0 ? " | " : null}
                            {row.subscriptionRunCount > 0
                              ? `local subscription: ${row.subscriptionRunCount} (${formatTokens(row.subscriptionInputTokens)} in / ${formatTokens(row.subscriptionOutputTokens)} out tok)`
                              : null}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
