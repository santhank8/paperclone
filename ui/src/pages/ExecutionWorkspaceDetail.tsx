import { Link, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { humanizeEnumValue, translateStatusLabel } from "../lib/i18n-labels";
import { queryKeys } from "../lib/queryKeys";
import { formatDateTime } from "../lib/utils";

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-28 shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

export function ExecutionWorkspaceDetail() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const { data: workspace, isLoading, error } = useQuery({
    queryKey: queryKeys.executionWorkspaces.detail(workspaceId!),
    queryFn: () => executionWorkspacesApi.get(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : t("executionWorkspace.loadFailed")}
      </p>
    );
  }
  if (!workspace) return null;

  const statusLabel = translateStatusLabel(t, workspace.status);
  const modeLabel = t(`executionWorkspace.mode.${workspace.mode}`, {
    defaultValue: humanizeEnumValue(workspace.mode),
  });
  const providerTypeLabel = t(`executionWorkspace.providerType.${workspace.providerType}`, {
    defaultValue: humanizeEnumValue(workspace.providerType),
  });
  const noneLabel = t("common.none");
  const cleanupLabel = workspace.cleanupEligibleAt
    ? `${formatDateTime(workspace.cleanupEligibleAt)}${workspace.cleanupReason ? ` · ${workspace.cleanupReason}` : ""}`
    : t("executionWorkspace.cleanupNotScheduled");

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{t("executionWorkspace.title")}</div>
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <div className="text-sm text-muted-foreground">
          {statusLabel} · {modeLabel} · {providerTypeLabel}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <DetailRow label={t("executionWorkspace.project")}>
          {workspace.projectId ? <Link to={`/projects/${workspace.projectId}`} className="hover:underline">{workspace.projectId}</Link> : noneLabel}
        </DetailRow>
        <DetailRow label={t("executionWorkspace.sourceIssue")}>
          {workspace.sourceIssueId ? <Link to={`/issues/${workspace.sourceIssueId}`} className="hover:underline">{workspace.sourceIssueId}</Link> : noneLabel}
        </DetailRow>
        <DetailRow label={t("executionWorkspace.branch")}>{workspace.branchName ?? noneLabel}</DetailRow>
        <DetailRow label={t("executionWorkspace.baseRef")}>{workspace.baseRef ?? noneLabel}</DetailRow>
        <DetailRow label={t("executionWorkspace.workingDir")}>
          <span className="break-all font-mono text-xs">{workspace.cwd ?? noneLabel}</span>
        </DetailRow>
        <DetailRow label={t("executionWorkspace.providerRef")}>
          <span className="break-all font-mono text-xs">{workspace.providerRef ?? noneLabel}</span>
        </DetailRow>
        <DetailRow label={t("executionWorkspace.repoUrl")}>
          {workspace.repoUrl && isSafeExternalUrl(workspace.repoUrl) ? (
            <a href={workspace.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              {workspace.repoUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : workspace.repoUrl ? (
            <span className="break-all font-mono text-xs">{workspace.repoUrl}</span>
          ) : noneLabel}
        </DetailRow>
        <DetailRow label={t("executionWorkspace.openedAt")}>{formatDateTime(workspace.openedAt)}</DetailRow>
        <DetailRow label={t("executionWorkspace.lastUsedAt")}>{formatDateTime(workspace.lastUsedAt)}</DetailRow>
        <DetailRow label={t("executionWorkspace.cleanup")}>
          {cleanupLabel}
        </DetailRow>
      </div>
    </div>
  );
}
