import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "@/lib/router";
import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { workflowsApi } from "../api/workflows";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { formatDateTime } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { WorkflowDiagram } from "../components/workflow/WorkflowDiagram";
import { WorkflowStepTimeline } from "../components/workflow/WorkflowStepTimeline";
import { Button } from "@/components/ui/button";

function runStatusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-green-500/10 text-green-600",
    running: "bg-blue-500/10 text-blue-600",
    pending: "bg-yellow-500/10 text-yellow-600",
    waiting_input: "bg-purple-500/10 text-purple-600",
    failed: "bg-red-500/10 text-red-600",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const ACTIVE_STATUSES = new Set(["pending", "running", "waiting_input"]);

export function WorkflowRunDetail() {
  const { workflowId, runId } = useParams<{ workflowId: string; runId: string }>();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: queryKeys.workflows.runDetail(runId!),
    queryFn: () => workflowsApi.getRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.has(status) ? 5000 : false;
    },
  });

  const { data: steps } = useQuery({
    queryKey: queryKeys.workflows.runSteps(runId!),
    queryFn: () => workflowsApi.getRunSteps(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      return run?.status && ACTIVE_STATUSES.has(run.status) ? 5000 : false;
    },
  });

  const { data: mermaidData } = useQuery({
    queryKey: queryKeys.workflows.runMermaid(runId!),
    queryFn: () => workflowsApi.getRunMermaid(runId!),
    enabled: !!runId,
    refetchInterval: () => {
      return run?.status && ACTIVE_STATUSES.has(run.status) ? 5000 : false;
    },
  });

  const { data: workflow } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId!),
    queryFn: () => workflowsApi.get(workflowId!),
    enabled: !!workflowId,
  });

  const cancelRun = useMutation({
    mutationFn: () => workflowsApi.cancelRun(runId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.runDetail(runId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.runSteps(runId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.runs(workflowId!) });
      pushToast({ title: "Run cancelled", tone: "success" });
    },
    onError: () => pushToast({ title: "Failed to cancel run", tone: "error" }),
  });

  useEffect(() => {
    if (!workflow || !run) return;
    setBreadcrumbs([
      { label: "Workflows", href: "/workflows" },
      { label: workflow.name, href: `/workflows/${workflowId}` },
      { label: `Run ${run.id.slice(0, 8)}` },
    ]);
  }, [workflow, run, workflowId, setBreadcrumbs]);

  if (runLoading) return <PageSkeleton />;
  if (!run) return <div className="p-6 text-muted-foreground">Run not found.</div>;

  const isActive = ACTIVE_STATUSES.has(run.status);
  const completedSteps = steps?.filter((s) => s.status === "accepted" || s.status === "submitted").length ?? 0;
  const totalSteps = steps?.length ?? 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Run {run.id.slice(0, 8)}</h1>
            {runStatusBadge(run.status)}
          </div>
          {workflow && (
            <p className="mt-1 text-sm text-muted-foreground">
              Workflow:{" "}
              <Link to={`/workflows/${workflowId}`} className="text-blue-500 hover:text-blue-600 transition-colors">
                {workflow.name}
              </Link>
              {" "}v{run.workflowVersion}
            </p>
          )}
        </div>
        {isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => cancelRun.mutate()}
            disabled={cancelRun.isPending}
            className="text-red-600 hover:text-red-700"
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Trigger</p>
          <p className="mt-0.5 text-sm">{run.triggerSource}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Created</p>
          <p className="mt-0.5 text-sm" title={formatDateTime(run.createdAt)}>
            {timeAgo(run.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Started</p>
          <p className="mt-0.5 text-sm" title={run.startedAt ? formatDateTime(run.startedAt) : undefined}>
            {run.startedAt ? timeAgo(run.startedAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Completed</p>
          <p className="mt-0.5 text-sm" title={run.completedAt ? formatDateTime(run.completedAt) : undefined}>
            {run.completedAt ? timeAgo(run.completedAt) : "—"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Step progress</span>
            <span className="text-muted-foreground">{completedSteps}/{totalSteps} steps ({progressPct}%)</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {run.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-600">Run error</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-red-500/90">
                {run.error}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Workflow diagram */}
      {mermaidData?.mermaid && (
        <WorkflowDiagram
          source={mermaidData.mermaid}
          title="Workflow graph"
        />
      )}

      {/* Step timeline */}
      {steps && steps.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Steps</h3>
          <WorkflowStepTimeline
            steps={steps}
            currentStepKey={run.currentStepKey}
            showDetails
          />
        </div>
      )}

      {/* Result JSON */}
      {run.resultJson && Object.keys(run.resultJson).length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Result
          </h3>
          <pre className="max-h-60 overflow-auto rounded bg-muted/30 p-3 text-xs">
            {JSON.stringify(run.resultJson, null, 2)}
          </pre>
        </div>
      )}

      {/* State JSON (collapsible for debugging) */}
      {run.stateJson && Object.keys(run.stateJson).length > 0 && (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
            Run state (debug)
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted/30 p-3 text-xs">
            {JSON.stringify(run.stateJson, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
