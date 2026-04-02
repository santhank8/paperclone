import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { StageBadge } from "@paperclipai/virtual-org-ui";
import { Input } from "@/components/ui/input";
import { queryKeys } from "../lib/queryKeys";
import { virtualOrgApi } from "../api/virtualOrg";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CompanyWorkspace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [captureText, setCaptureText] = useState("");
  const [internalDbConnectionString, setInternalDbConnectionString] = useState("");
  const [internalDbSqlQuery, setInternalDbSqlQuery] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Workspace" }]);
  }, [setBreadcrumbs]);

  const workspaceQuery = useQuery({
    queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId ?? ""),
    queryFn: () => virtualOrgApi.workspace(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const createInboxItem = useMutation({
    mutationFn: () =>
      virtualOrgApi.createInboxItem({
        companyId: selectedCompanyId,
        rawContent: captureText,
        workType: "founder_capture",
        urgency: "medium",
      }),
    onSuccess: () => {
      setCaptureText("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });
  const syncOfficely = useMutation({
    mutationFn: () => virtualOrgApi.syncOfficelyV1(selectedCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });
  const saveInternalDatabaseSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.saveOfficelyInternalDatabaseSetup(selectedCompanyId!, {
        connectionString: internalDbConnectionString.trim() || null,
        sqlQuery: internalDbSqlQuery,
      }),
    onSuccess: () => {
      setInternalDbConnectionString("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });

  const testInternalDatabaseSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.testOfficelyInternalDatabaseSetup(selectedCompanyId!, {
        connectionString: internalDbConnectionString.trim() || null,
        sqlQuery: internalDbSqlQuery,
      }),
  });

  useEffect(() => {
    syncOfficely.reset();
    saveInternalDatabaseSetup.reset();
    testInternalDatabaseSetup.reset();
  }, [selectedCompanyId]);

  const workspace = workspaceQuery.data ?? null;
  const internalDatabaseConnector = workspace?.connectors.find((connector) => connector.kind === "internal_database") ?? null;
  const savedInternalDbQuery =
    internalDatabaseConnector && typeof internalDatabaseConnector.configJson.sqlQuery === "string"
      ? internalDatabaseConnector.configJson.sqlQuery
      : "";
  const hasSavedInternalDbConnection =
    internalDatabaseConnector && typeof internalDatabaseConnector.configJson.connectionSecretId === "string";

  useEffect(() => {
    setInternalDbConnectionString("");
    setInternalDbSqlQuery(savedInternalDbQuery);
  }, [selectedCompanyId, savedInternalDbQuery]);

  if (!selectedCompanyId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Select a company to view its workspace.
      </div>
    );
  }

  if (workspaceQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading workspace...</div>;
  }

  if (workspaceQuery.error) {
    return <div className="text-sm text-destructive">{workspaceQuery.error.message}</div>;
  }

  const resolvedWorkspace = workspaceQuery.data!;
  const isOfficelyWorkspace = resolvedWorkspace.connectors.some((connector) =>
    ["internal_database", "xero", "stripe", "posthog"].includes(connector.kind),
  );
  const syncOfficelyData = syncOfficely.data?.companyId === selectedCompanyId ? syncOfficely.data : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{resolvedWorkspace.company.name}</h1>
              <StageBadge stage={resolvedWorkspace.profile.stage} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{resolvedWorkspace.profile.primaryGoal}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {resolvedWorkspace.profile.activeCapabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {capability.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full max-w-xl space-y-3">
            <textarea
              className="min-h-28 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none"
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder="Drop a founder request here. This creates a tracked inbox item and task for this company."
            />
            <div className="flex justify-end">
              <Button
                onClick={() => createInboxItem.mutate()}
                disabled={!captureText.trim() || createInboxItem.isPending}
              >
                {createInboxItem.isPending ? "Capturing..." : "Create work item"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Suggested agents</h2>
              <p className="text-sm text-muted-foreground">
                These templates are filtered by company stage so Muster and Officely do not get the same team by default.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {resolvedWorkspace.templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-border p-4">
                <h3 className="font-medium">{template.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Responsibilities</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {template.defaultResponsibilities.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Link
                    to={`/agents/new?name=${encodeURIComponent(template.name)}&title=${encodeURIComponent(template.defaultTitle)}&role=${encodeURIComponent(template.defaultRole)}`}
                    className="text-sm font-medium text-foreground underline underline-offset-2"
                  >
                    Add this agent
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Connected tools</h2>
              {isOfficelyWorkspace ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Run a manual heartbeat sync when you want to pull the latest customer, revenue, and usage snapshot.
                </p>
              ) : null}
            </div>
            {isOfficelyWorkspace ? (
              <Button
                variant="outline"
                onClick={() => syncOfficely.mutate()}
                disabled={syncOfficely.isPending}
              >
                {syncOfficely.isPending ? "Syncing..." : "Sync Officely now"}
              </Button>
            ) : null}
          </div>
          {isOfficelyWorkspace && internalDatabaseConnector ? (
            <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Internal database setup</h3>
                <p className="text-sm text-muted-foreground">
                  This is the trusted customer list. Add a read-only database address and a single SELECT query so Officely can match accounts safely.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Database connection string</span>
                  <Input
                    type="password"
                    value={internalDbConnectionString}
                    onChange={(event) => setInternalDbConnectionString(event.target.value)}
                    placeholder={hasSavedInternalDbConnection ? "Saved securely. Paste a new one only if you want to replace it." : "postgres://user:password@host:5432/database"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedInternalDbConnection
                      ? "A database key is already saved securely. Leave this blank to keep using it."
                      : "This is saved as a secret so it is not stored in plain text."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Read-only customer query</span>
                  <Textarea
                    value={internalDbSqlQuery}
                    onChange={(event) => setInternalDbSqlQuery(event.target.value)}
                    rows={10}
                    placeholder={[
                      "select",
                      "  internal_account_id,",
                      "  company_name,",
                      "  primary_email_domain",
                      "from customer_accounts",
                      "order by internal_account_id",
                    ].join("\n")}
                  />
                  <span className="text-xs text-muted-foreground">
                    One query only. It must start with SELECT and include at least `internal_account_id` and `company_name`.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testInternalDatabaseSetup.mutate()}
                    disabled={!internalDbSqlQuery.trim() || testInternalDatabaseSetup.isPending}
                  >
                    {testInternalDatabaseSetup.isPending ? "Testing..." : "Test connection"}
                  </Button>
                  <Button
                    onClick={() => saveInternalDatabaseSetup.mutate()}
                    disabled={!internalDbSqlQuery.trim() || saveInternalDatabaseSetup.isPending}
                  >
                    {saveInternalDatabaseSetup.isPending ? "Saving..." : "Save setup"}
                  </Button>
                </div>
                {testInternalDatabaseSetup.error ? (
                  <p className="text-sm text-destructive">{testInternalDatabaseSetup.error.message}</p>
                ) : null}
                {testInternalDatabaseSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    Connection worked. Found {testInternalDatabaseSetup.data.accountCount} accounts.
                    {testInternalDatabaseSetup.data.sampleCompanies.length > 0
                      ? ` Sample companies: ${testInternalDatabaseSetup.data.sampleCompanies.join(", ")}.`
                      : ""}
                    {testInternalDatabaseSetup.data.usedSavedConnection
                      ? " Used the saved database key."
                      : " Used the connection string you just pasted."}
                  </p>
                ) : null}
                {saveInternalDatabaseSetup.error ? (
                  <p className="text-sm text-destructive">{saveInternalDatabaseSetup.error.message}</p>
                ) : null}
                {saveInternalDatabaseSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    Setup verified and saved. Found {saveInternalDatabaseSetup.data.accountCount} accounts before saving.
                    {saveInternalDatabaseSetup.data.sampleCompanies.length > 0
                      ? ` Sample companies: ${saveInternalDatabaseSetup.data.sampleCompanies.join(", ")}.`
                      : ""}
                    {saveInternalDatabaseSetup.data.usedSavedConnection
                      ? " Verified with the saved database key."
                      : " Verified with the connection string you just pasted."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {syncOfficely.error && isOfficelyWorkspace ? (
            <p className="mt-3 text-sm text-destructive">{syncOfficely.error.message}</p>
          ) : null}
          {syncOfficelyData ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loaded {syncOfficelyData.counts.internalAccounts} internal accounts, {syncOfficelyData.counts.xeroInvoices} Xero invoices,
              {" "}{syncOfficelyData.counts.stripeEvents} Stripe events, and {syncOfficelyData.counts.posthogAccounts} PostHog accounts.
              {" "}Workspace now shows {syncOfficelyData.profileCount} customer profiles and {syncOfficelyData.insightCount} generated insight cards.
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {resolvedWorkspace.connectors.map((connector) => (
              <div key={connector.id} className="rounded-xl bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{connector.displayName}</div>
                    <div className="text-sm text-muted-foreground">{connector.configSummary}</div>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {connector.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Insight cards</h2>
          <div className="mt-4 space-y-3">
            {resolvedWorkspace.insights.map((insight) => (
              <div key={insight.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">{insight.title}</h3>
                  <span className="text-xs text-muted-foreground">{Math.round(insight.confidence * 100)}%</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{insight.summary}</p>
                {insight.recommendedAction ? (
                  <p className="mt-3 text-sm"><span className="font-medium">Next move:</span> {insight.recommendedAction}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Captured work</h2>
          <div className="mt-4 space-y-3">
            {resolvedWorkspace.inbox.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.status.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{item.source}</span>
                </div>
                <p className="mt-2 text-sm">{item.structuredSummary ?? item.rawContent}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Active work</h2>
          <div className="mt-4 space-y-3">
            {resolvedWorkspace.activeIssues.map((issue) => (
              <div key={issue.id} className="rounded-xl bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{issue.identifier ?? issue.id.slice(0, 8)}</div>
                    <div className="text-sm text-muted-foreground">{issue.title}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{issue.status}</div>
                    <div>{issue.priority}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Recent decisions</h2>
          <div className="mt-4 space-y-3">
            {resolvedWorkspace.recentDecisions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No decisions logged yet.
              </div>
            ) : (
              resolvedWorkspace.recentDecisions.map((decision) => (
                <div key={decision.id} className="rounded-xl border border-border p-4">
                  <h3 className="font-medium">{decision.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{decision.summary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
