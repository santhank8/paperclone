import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { docsApi } from "../api/docs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, issueUrl } from "../lib/utils";
import { FileText } from "lucide-react";

export function Docs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Docs" }]);
  }, [setBreadcrumbs]);

  const { data: docs, isLoading, error } = useQuery({
    queryKey: queryKeys.docs.list(selectedCompanyId!),
    queryFn: () => docsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view documents." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && (!docs || docs.length === 0) && (
        <EmptyState
          icon={FileText}
          message="No documents yet. Documents created on issues will appear here."
        />
      )}

      {docs && docs.length > 0 && (
        <div className="border border-border">
          {docs.map((doc) => (
            <EntityRow
              key={doc.id}
              identifier={doc.issueIdentifier ?? undefined}
              title={doc.title || doc.key}
              subtitle={doc.issueTitle}
              to={`${issueUrl({ id: doc.issueId, identifier: doc.issueIdentifier })}#document-${doc.key}`}
              trailing={
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    {doc.key}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(doc.updatedAt)}
                  </span>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
