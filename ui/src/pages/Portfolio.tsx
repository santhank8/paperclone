import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { CompanyHealthCard } from "@paperclipai/virtual-org-ui";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { virtualOrgApi } from "../api/virtualOrg";
import { Button } from "@/components/ui/button";
import { useCompany } from "../context/CompanyContext";

export function Portfolio() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companies } = useCompany();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Portfolio" }]);
  }, [setBreadcrumbs]);

  const portfolioQuery = useQuery({
    queryKey: queryKeys.virtualOrg.portfolio,
    queryFn: () => virtualOrgApi.portfolio(),
  });

  const bootstrap = useMutation({
    mutationFn: () => virtualOrgApi.bootstrapDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.portfolio });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const portfolio = portfolioQuery.data?.companies ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold">Founder control room</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              See every company, the stage it is in, what is blocked, and where AI help is actually useful.
            </p>
          </div>
          <Button
            onClick={() => bootstrap.mutate()}
            disabled={bootstrap.isPending}
          >
            {bootstrap.isPending ? "Setting up..." : "Set up Muster + Officely"}
          </Button>
        </div>
        {companies.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Existing companies in this instance: {companies.length}
          </p>
        ) : null}
      </div>

      {portfolioQuery.error ? (
        <p className="text-sm text-destructive">{portfolioQuery.error.message}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {portfolio.map((company) => (
          <Link key={company.companyId} to={`/${company.issuePrefix}/workspace`}>
            <CompanyHealthCard company={company} />
          </Link>
        ))}
      </div>

      {portfolio.length === 0 && !portfolioQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          No Virtual Org companies are configured yet. Use the setup button above to bootstrap Muster and Officely.
        </div>
      ) : null}
    </div>
  );
}
