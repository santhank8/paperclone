import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { User, Users } from "lucide-react";
import { accessApi } from "../api/access";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Identity } from "../components/Identity";

export function Humans() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Humans" }]);
  }, [setBreadcrumbs]);

  const { data: members, isLoading, error } = useQuery({
    queryKey: queryKeys.access.humanMembers(selectedCompanyId!),
    queryFn: () => accessApi.listHumanMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Users} message="Select a company to view human members." />;
  }

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load members."}
      </p>
    );
  }

  if (!members || members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message="No human members yet. Generate an invite link in Company Settings to add humans."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Humans</h1>
      <div className="divide-y divide-border rounded-xl border border-border">
        {members.map((member) => {
          const label = member.name ?? member.email ?? member.id.slice(0, 8);
          return (
            <Link
              key={member.id}
              to={`/humans/${member.id}`}
              className="flex items-center gap-3 px-4 py-3 no-underline text-inherit transition-colors hover:bg-accent/50"
            >
              <Identity name={label} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                {member.name && member.email && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
