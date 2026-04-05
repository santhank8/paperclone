import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Send,
  RotateCcw,
} from "lucide-react";
import { deliverablesApi, type Deliverable } from "../api/deliverables";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@/lib/router";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  review: { label: "Pending Review", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  delivered: { label: "Delivered", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  "weekly-report": "Weekly Report",
  "monthly-report": "Monthly Report",
  "board-packet": "Board Packet",
  "post-mortem": "Post-Mortem",
  "decision": "Decision",
  "meeting-minutes": "Meeting Minutes",
  "client-update": "Client Update",
  "retrospective": "Retrospective",
};

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_CONFIG[status ?? "draft"] ?? STATUS_CONFIG.draft;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Deliverable Row                                                    */
/* ------------------------------------------------------------------ */

interface DeliverableRowProps {
  deliverable: Deliverable;
  onApprove: (id: string) => void;
  onRequestRevision: (id: string) => void;
  isUpdating: boolean;
}

function DeliverableRow({ deliverable, onApprove, onRequestRevision, isUpdating }: DeliverableRowProps) {
  const docTypeLabel = DOC_TYPE_LABELS[deliverable.documentType ?? ""] ?? deliverable.documentType ?? "Document";
  const isInReview = deliverable.deliverableStatus === "review";

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/knowledge/${deliverable.id}`}
            className="text-sm font-medium hover:underline truncate"
          >
            {deliverable.title}
          </Link>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {docTypeLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {deliverable.agentName && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {deliverable.agentName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(deliverable.updatedAt)}
          </span>
        </div>
      </div>

      <StatusBadge status={deliverable.deliverableStatus} />

      {isInReview && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isUpdating}
            onClick={() => onRequestRevision(deliverable.id)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Revise
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={isUpdating}
            onClick={() => onApprove(deliverable.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approve
          </Button>
        </div>
      )}
      {deliverable.deliverableStatus === "approved" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0"
          disabled={isUpdating}
          onClick={() => {
            deliverablesApi.updateStatus(deliverable.companyId, deliverable.id, "delivered");
          }}
        >
          <Send className="h-3 w-3 mr-1" />
          Mark Delivered
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Deliverables Page                                             */
/* ------------------------------------------------------------------ */

export function Deliverables() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "Deliverables" }]);
  }, [setBreadcrumbs]);

  const { data: deliverables, isLoading } = useQuery({
    queryKey: ["deliverables", selectedCompanyId, statusFilter],
    queryFn: () => deliverablesApi.list(selectedCompanyId!, statusFilter === "all" ? undefined : statusFilter),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      deliverablesApi.updateStatus(selectedCompanyId!, id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverables", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: () => {
      pushToast({ title: "Failed to update deliverable status", tone: "error" });
    },
  });

  const pendingReviewCount = (deliverables ?? []).filter((d) => d.deliverableStatus === "review").length;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Deliverables</h1>
          {pendingReviewCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {pendingReviewCount} pending review
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!deliverables || deliverables.length === 0 ? (
          <EmptyState
            icon={FileText}
            message="No deliverables yet. Auto-generated reports, board packets, and other documents will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {deliverables.map((d) => (
              <DeliverableRow
                key={d.id}
                deliverable={d}
                isUpdating={updateMutation.isPending}
                onApprove={(id) => updateMutation.mutate({ id, status: "approved" })}
                onRequestRevision={(id) => updateMutation.mutate({ id, status: "draft" })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
