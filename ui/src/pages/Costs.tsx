import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatCents, formatTokens } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Pencil, Check, X } from "lucide-react";

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

function BudgetEditor({
  currentCents,
  onSave,
  isPending,
  label,
}: {
  currentCents: number;
  onSave: (cents: number) => void;
  isPending: boolean;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() =>
    currentCents > 0 ? (currentCents / 100).toFixed(2) : "",
  );

  useEffect(() => {
    setValue(currentCents > 0 ? (currentCents / 100).toFixed(2) : "");
  }, [currentCents]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        title={label ?? "Edit budget"}
      >
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  function handleSave() {
    const dollars = parseFloat(value);
    const cents = !value || isNaN(dollars) ? 0 : Math.round(dollars * 100);
    onSave(cents);
    setEditing(false);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm text-muted-foreground">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0.00"
        className="w-20 h-6 rounded border border-border bg-transparent px-1.5 text-sm outline-none text-right"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="text-green-600 hover:text-green-700 disabled:opacity-50"
        title="Save"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-muted-foreground hover:text-foreground"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

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
      const [summary, byAgent, byProject] = await Promise.all([
        costsApi.summary(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byAgent(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProject(selectedCompanyId!, from || undefined, to || undefined),
      ]);
      return { summary, byAgent, byProject };
    },
    enabled: !!selectedCompanyId,
  });

  const companyBudgetMutation = useMutation({
    mutationFn: (cents: number) =>
      costsApi.updateCompanyBudget(selectedCompanyId!, cents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined) });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const agentBudgetMutation = useMutation({
    mutationFn: ({ agentId, cents }: { agentId: string; cents: number }) =>
      costsApi.updateAgentBudget(agentId, cents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined) });
    },
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
          {/* Summary card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</p>
                {data.summary.budgetCents > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {data.summary.utilizationPercent}% utilized
                  </p>
                )}
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatCents(data.summary.spendCents)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {data.summary.budgetCents > 0
                    ? `/ ${formatCents(data.summary.budgetCents)}`
                    : "No budget limit"}{" "}
                  <BudgetEditor
                    currentCents={data.summary.budgetCents}
                    onSave={(cents) => companyBudgetMutation.mutate(cents)}
                    isPending={companyBudgetMutation.isPending}
                    label="Edit company monthly budget"
                  />
                </span>
              </p>
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
            </CardContent>
          </Card>

          {/* By Agent / By Project */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">By Agent</h3>
                {data.byAgent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cost events yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.byAgent.map((row) => (
                      <div
                        key={row.agentId}
                        className="space-y-1"
                      >
                        <div className="flex items-start justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Identity
                              name={row.agentName ?? row.agentId}
                              size="sm"
                            />
                            {row.agentStatus === "terminated" && (
                              <StatusBadge status="terminated" />
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-medium block">{formatCents(row.costCents)}</span>
                            <span className="text-xs text-muted-foreground block">
                              in {formatTokens(row.inputTokens)} / out {formatTokens(row.outputTokens)} tok
                            </span>
                            {(row.apiRunCount > 0 || row.subscriptionRunCount > 0) && (
                              <span className="text-xs text-muted-foreground block">
                                {row.apiRunCount > 0 ? `api runs: ${row.apiRunCount}` : null}
                                {row.apiRunCount > 0 && row.subscriptionRunCount > 0 ? " | " : null}
                                {row.subscriptionRunCount > 0
                                  ? `subscription runs: ${row.subscriptionRunCount} (${formatTokens(row.subscriptionInputTokens)} in / ${formatTokens(row.subscriptionOutputTokens)} out tok)`
                                  : null}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-7">
                          <span>
                            Budget: {row.budgetMonthlyCents > 0 ? `${formatCents(row.budgetMonthlyCents)}/mo` : "Unlimited"}
                          </span>
                          <BudgetEditor
                            currentCents={row.budgetMonthlyCents}
                            onSave={(cents) => agentBudgetMutation.mutate({ agentId: row.agentId, cents })}
                            isPending={agentBudgetMutation.isPending}
                            label={`Edit budget for ${row.agentName ?? "agent"}`}
                          />
                          {row.budgetMonthlyCents > 0 && (
                            <span className="text-muted-foreground">
                              ({Math.min(100, Math.round((row.costCents / row.budgetMonthlyCents) * 100))}% used)
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
                        <span className="font-medium tabular-nums">{formatCents(row.costCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
