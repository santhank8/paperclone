import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { StageBadge } from "@paperclipai/virtual-org-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { queryKeys } from "../lib/queryKeys";
import { virtualOrgApi } from "../api/virtualOrg";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { normalizeFounderBrief } from "../lib/founder-brief";
import { normalizeRevenueScorecard } from "../lib/revenue-scorecard";

function formatMoney(amount: number, currency: string) {
  if (currency === "mixed") return amount.toFixed(2);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedMoney(amount: number, currency: string) {
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(amount), currency)}`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function parseEventList(value: string) {
  return [...new Set(
    value
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )];
}

function formatMonthYear(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "latest full month";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatConnectorTime(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

function formatReceiptDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatDateRange(start: string, end: string) {
  const parsedStart = new Date(start);
  const parsedEnd = new Date(end);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) return "Last 30 days";
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(parsedStart)} to ${formatter.format(parsedEnd)}`;
}

function connectorEnabled(configJson: Record<string, unknown>) {
  return configJson.enabled !== false;
}

function statusClasses(status: "healthy" | "watch" | "risk" | "unavailable") {
  if (status === "healthy") return "bg-emerald-100 text-emerald-800";
  if (status === "watch") return "bg-amber-100 text-amber-800";
  if (status === "risk") return "bg-rose-100 text-rose-800";
  return "bg-muted text-muted-foreground";
}

function priorityClasses(priority: "high" | "medium" | "low") {
  if (priority === "high") return "bg-rose-100 text-rose-800";
  if (priority === "medium") return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

function feedbackBucketLabel(bucket: "customer_feedback" | "tech_issues" | "other") {
  if (bucket === "customer_feedback") return "customer feedback";
  if (bucket === "tech_issues") return "tech issues";
  return "other";
}

export function CompanyWorkspace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [captureText, setCaptureText] = useState("");
  const [internalDbConnectionString, setInternalDbConnectionString] = useState("");
  const [internalDbSqlQuery, setInternalDbSqlQuery] = useState("");
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackAppToken, setSlackAppToken] = useState("");
  const [slackDefaultChannelId, setSlackDefaultChannelId] = useState("");
  const [slackFounderUserId, setSlackFounderUserId] = useState("");
  const [slackIntakeMode, setSlackIntakeMode] = useState<"dm_only" | "dm_and_channel">("dm_only");
  const [posthogEnabled, setPosthogEnabled] = useState(true);
  const [posthogApiKey, setPosthogApiKey] = useState("");
  const [posthogProjectId, setPosthogProjectId] = useState("");
  const [posthogBaseUrl, setPosthogBaseUrl] = useState("https://us.posthog.com");
  const [posthogOnboardingEvent, setPosthogOnboardingEvent] = useState("");
  const [posthogImportantEvents, setPosthogImportantEvents] = useState("");

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
  const saveXeroSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.saveOfficelyXeroSetup(selectedCompanyId!, {
        clientId: xeroClientId.trim() || null,
        clientSecret: xeroClientSecret.trim() || null,
      }),
    onSuccess: () => {
      setXeroClientId("");
      setXeroClientSecret("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });

  const testXeroSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.testOfficelyXeroSetup(selectedCompanyId!, {
        clientId: xeroClientId.trim() || null,
        clientSecret: xeroClientSecret.trim() || null,
      }),
  });
  const saveSlackSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.saveOfficelySlackSetup(selectedCompanyId!, {
        enabled: slackEnabled,
        botToken: slackBotToken.trim() || null,
        appToken: slackAppToken.trim() || null,
        defaultChannelId: slackDefaultChannelId.trim() || null,
        founderUserId: slackFounderUserId.trim() || null,
        intakeMode: slackIntakeMode,
      }),
    onSuccess: () => {
      setSlackBotToken("");
      setSlackAppToken("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });

  const testSlackSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.testOfficelySlackSetup(selectedCompanyId!, {
        enabled: slackEnabled,
        botToken: slackBotToken.trim() || null,
        appToken: slackAppToken.trim() || null,
        defaultChannelId: slackDefaultChannelId.trim() || null,
        founderUserId: slackFounderUserId.trim() || null,
        intakeMode: slackIntakeMode,
      }),
  });
  const saveStripeSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.saveOfficelyStripeSetup(selectedCompanyId!, {
        secretKey: stripeSecretKey.trim() || null,
      }),
    onSuccess: () => {
      setStripeSecretKey("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });

  const testStripeSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.testOfficelyStripeSetup(selectedCompanyId!, {
        secretKey: stripeSecretKey.trim() || null,
      }),
  });
  const savePostHogSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.saveOfficelyPostHogSetup(selectedCompanyId!, {
        enabled: posthogEnabled,
        apiKey: posthogApiKey.trim() || null,
        projectId: posthogProjectId.trim() || null,
        baseUrl: posthogBaseUrl.trim() || null,
        onboardingEvent: posthogOnboardingEvent.trim() || null,
        importantEvents: parseEventList(posthogImportantEvents),
      }),
    onSuccess: () => {
      setPosthogApiKey("");
      queryClient.invalidateQueries({ queryKey: queryKeys.virtualOrg.workspace(selectedCompanyId!) });
    },
  });

  const testPostHogSetup = useMutation({
    mutationFn: () =>
      virtualOrgApi.testOfficelyPostHogSetup(selectedCompanyId!, {
        enabled: posthogEnabled,
        apiKey: posthogApiKey.trim() || null,
        projectId: posthogProjectId.trim() || null,
        baseUrl: posthogBaseUrl.trim() || null,
        onboardingEvent: posthogOnboardingEvent.trim() || null,
        importantEvents: parseEventList(posthogImportantEvents),
      }),
  });

  useEffect(() => {
    syncOfficely.reset();
    saveInternalDatabaseSetup.reset();
    testInternalDatabaseSetup.reset();
    saveXeroSetup.reset();
    testXeroSetup.reset();
    saveSlackSetup.reset();
    testSlackSetup.reset();
    saveStripeSetup.reset();
    testStripeSetup.reset();
    savePostHogSetup.reset();
    testPostHogSetup.reset();
  }, [selectedCompanyId]);

  const workspace = workspaceQuery.data ?? null;
  const slackConnector = workspace?.connectors.find((connector) => connector.kind === "slack") ?? null;
  const internalDatabaseConnector = workspace?.connectors.find((connector) => connector.kind === "internal_database") ?? null;
  const posthogConnector = workspace?.connectors.find((connector) => connector.kind === "posthog") ?? null;
  const xeroConnector = workspace?.connectors.find((connector) => connector.kind === "xero") ?? null;
  const stripeConnector = workspace?.connectors.find((connector) => connector.kind === "stripe") ?? null;
  const savedInternalDbQuery =
    internalDatabaseConnector && typeof internalDatabaseConnector.configJson.sqlQuery === "string"
      ? internalDatabaseConnector.configJson.sqlQuery
      : "";
  const hasSavedInternalDbConnection =
    internalDatabaseConnector && typeof internalDatabaseConnector.configJson.connectionSecretId === "string";
  const hasSavedXeroClientId =
    xeroConnector && typeof xeroConnector.configJson.clientIdSecretId === "string";
  const hasSavedXeroClientSecret =
    xeroConnector && typeof xeroConnector.configJson.clientSecretSecretId === "string";
  const hasSavedSlackBotToken =
    slackConnector && typeof slackConnector.configJson.botTokenSecretId === "string";
  const hasSavedSlackAppToken =
    slackConnector && typeof slackConnector.configJson.appTokenSecretId === "string";
  const hasSavedStripeSecretKey =
    stripeConnector && typeof stripeConnector.configJson.secretKeySecretId === "string";
  const hasSavedPostHogApiKey =
    posthogConnector && typeof posthogConnector.configJson.apiKeySecretId === "string";

  useEffect(() => {
    setInternalDbConnectionString("");
    setInternalDbSqlQuery(savedInternalDbQuery);
    setXeroClientId("");
    setXeroClientSecret("");
    setSlackEnabled(slackConnector ? connectorEnabled(slackConnector.configJson) : true);
    setSlackBotToken("");
    setSlackAppToken("");
    setSlackDefaultChannelId(
      slackConnector && typeof slackConnector.configJson.defaultChannelId === "string"
        ? slackConnector.configJson.defaultChannelId
        : "",
    );
    setSlackFounderUserId(
      slackConnector && typeof slackConnector.configJson.founderUserId === "string"
        ? slackConnector.configJson.founderUserId
        : "",
    );
    setSlackIntakeMode(
      slackConnector?.configJson.intakeMode === "dm_and_channel" ? "dm_and_channel" : "dm_only",
    );
    setStripeSecretKey("");
    setPosthogEnabled(posthogConnector ? connectorEnabled(posthogConnector.configJson) : true);
    setPosthogApiKey("");
    setPosthogProjectId(
      posthogConnector && typeof posthogConnector.configJson.projectId === "string"
        ? posthogConnector.configJson.projectId
        : "",
    );
    setPosthogBaseUrl(
      posthogConnector && typeof posthogConnector.configJson.baseUrl === "string"
        ? posthogConnector.configJson.baseUrl
        : "https://us.posthog.com",
    );
    setPosthogOnboardingEvent(
      posthogConnector && typeof posthogConnector.configJson.onboardingEvent === "string"
        ? posthogConnector.configJson.onboardingEvent
        : "",
    );
    setPosthogImportantEvents(
      posthogConnector && Array.isArray(posthogConnector.configJson.importantEvents)
        ? posthogConnector.configJson.importantEvents.filter((value): value is string => typeof value === "string").join("\n")
        : "",
    );
  }, [selectedCompanyId, savedInternalDbQuery, slackConnector, posthogConnector]);

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
  const revenueScorecard = normalizeRevenueScorecard(resolvedWorkspace.profile.operatingSnapshotJson?.revenueScorecard);
  const founderBrief = normalizeFounderBrief(resolvedWorkspace.profile.operatingSnapshotJson?.founderBrief);
  const revenueScorecardMonth = revenueScorecard ? formatMonthYear(revenueScorecard.periodStart) : null;

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

      {isOfficelyWorkspace && revenueScorecard ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Monthly revenue scorecard</h2>
            <p className="text-sm text-muted-foreground">
              This uses the latest fully completed month, currently {revenueScorecardMonth}. Stripe revenue comes straight from Stripe. Manual revenue comes from Xero. Total adds them together.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="mt-2 text-2xl font-semibold">{formatMoney(revenueScorecard.totalRevenue, revenueScorecard.liveRevenueCurrency)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{revenueScorecardMonth}</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Stripe revenue</div>
              <div className="mt-2 text-2xl font-semibold">{formatMoney(revenueScorecard.stripeRevenue, revenueScorecard.liveRevenueCurrency)}</div>
              <div className="mt-1 text-sm text-muted-foreground">Automated billing</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Manual revenue from Xero</div>
              <div className="mt-2 text-2xl font-semibold">{formatMoney(revenueScorecard.manualRevenue, revenueScorecard.liveRevenueCurrency)}</div>
              <div className="mt-1 text-sm text-muted-foreground">Outside Stripe</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Failed payments</div>
              <div className="mt-2 text-2xl font-semibold">{revenueScorecard.failedPayments}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatMoney(revenueScorecard.failedPaymentAmount, revenueScorecard.currency)} at risk
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Refunds</div>
              <div className="mt-2 text-2xl font-semibold">{revenueScorecard.refunds}</div>
              <div className="mt-1 text-sm text-muted-foreground">{formatMoney(revenueScorecard.refundAmount, revenueScorecard.currency)} returned</div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Active customers</div>
              <div className="mt-2 text-2xl font-semibold">
                {revenueScorecard.currentCustomers}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Prev {revenueScorecard.previousCustomers}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-border p-4">
              <h3 className="font-medium">Revenue movement</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the month-over-month movement view. It is useful for trends, but the headline numbers above are the main operating view.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">New</div>
                  <div className="mt-1 font-semibold">{formatMoney(revenueScorecard.newMrr, revenueScorecard.currency)}</div>
                  <div className="text-sm text-muted-foreground">{revenueScorecard.newCustomers} customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Expansion</div>
                  <div className="mt-1 font-semibold">{formatMoney(revenueScorecard.expansionMrr, revenueScorecard.currency)}</div>
                  <div className="text-sm text-muted-foreground">{revenueScorecard.expandedCustomers} customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Reactivation</div>
                  <div className="mt-1 font-semibold">{formatMoney(revenueScorecard.reactivationMrr, revenueScorecard.currency)}</div>
                  <div className="text-sm text-muted-foreground">{revenueScorecard.reactivatedCustomers} customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Contraction</div>
                  <div className="mt-1 font-semibold">{formatMoney(revenueScorecard.contractionMrr, revenueScorecard.currency)}</div>
                  <div className="text-sm text-muted-foreground">{revenueScorecard.contractedCustomers} customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Churn</div>
                  <div className="mt-1 font-semibold">{formatMoney(revenueScorecard.churnedMrr, revenueScorecard.currency)}</div>
                  <div className="text-sm text-muted-foreground">{revenueScorecard.lostCustomers} customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Active customers</div>
                  <div className="mt-1 font-semibold">{revenueScorecard.currentCustomers}</div>
                  <div className="text-sm text-muted-foreground">Prev {revenueScorecard.previousCustomers}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="font-medium">Monthly health</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These are the simple month-end signals that help you see whether revenue is growing cleanly.
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall change</div>
                  <div className="mt-1 font-semibold">
                    {formatSignedMoney(revenueScorecard.overallChange, revenueScorecard.currency)}
                  </div>
                  <div className="text-muted-foreground">Growth {formatPercent(revenueScorecard.revenueGrowthRate)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Revenue churn</div>
                  <div className="mt-1 font-semibold">
                    {formatPercent(revenueScorecard.revenueChurnRate)}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMoney(revenueScorecard.contractionMrr + revenueScorecard.churnedMrr, revenueScorecard.currency)} lost
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer churn</div>
                  <div className="mt-1 font-semibold">
                    {formatPercent(revenueScorecard.customerChurnRate)}
                  </div>
                  <div className="text-muted-foreground">{revenueScorecard.lostCustomers} lost customers</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Net new revenue</div>
                  <div className="mt-1 font-semibold">
                    {formatSignedMoney(revenueScorecard.netNewMrr, revenueScorecard.currency)}
                  </div>
                  <div className="text-muted-foreground">Net position {revenueScorecard.netPosition}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated LTV</div>
                  <div className="mt-1 font-semibold">
                    {revenueScorecard.estimatedLtv === null ? "n/a" : formatMoney(revenueScorecard.estimatedLtv, revenueScorecard.currency)}
                  </div>
                  <div className="text-muted-foreground">Early estimate</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="font-medium">Recent billing attention</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These stay on a recent rolling window so you can act quickly.
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Failed payments</div>
                  <div className="mt-1 font-semibold">
                    {revenueScorecard.failedPayments} worth {formatMoney(revenueScorecard.failedPaymentAmount, revenueScorecard.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Refunds</div>
                  <div className="mt-1 font-semibold">
                    {revenueScorecard.refunds} worth {formatMoney(revenueScorecard.refundAmount, revenueScorecard.currency)}
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Use this block as the last-30-days follow-up list. It is the fastest path to protecting revenue already in motion.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isOfficelyWorkspace && founderBrief ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Founder brief</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Updated {formatConnectorTime(founderBrief.generatedAt) ?? "just now"}
              </span>
            </div>
            <p className="text-sm font-medium">{founderBrief.headline}</p>
            <p className="text-sm text-muted-foreground">{founderBrief.summary}</p>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Product pulse</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClasses(founderBrief.productPulse.status)}`}>
                    {founderBrief.productPulse.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{founderBrief.productPulse.summary}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Active users</div>
                    <div className="mt-1 font-semibold">{founderBrief.productPulse.activeUserTotal}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Tracked events</div>
                    <div className="mt-1 font-semibold">{founderBrief.productPulse.eventCount}</div>
                  </div>
                </div>
                {founderBrief.productPulse.onboardingEvent ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {founderBrief.productPulse.onboardingEvent} fired {founderBrief.productPulse.onboardingEventCount} time{founderBrief.productPulse.onboardingEventCount === 1 ? "" : "s"}.
                  </div>
                ) : null}
                {founderBrief.productPulse.importantEventCounts.length > 0 ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {founderBrief.productPulse.importantEventCounts.slice(0, 4).map((eventMetric) => (
                      <div key={eventMetric.eventName} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{eventMetric.eventName}</span>
                        <span className="font-medium">{eventMetric.count}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Customer feedback and tech issues</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClasses(founderBrief.feedbackPulse.status)}`}>
                    {founderBrief.feedbackPulse.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{founderBrief.feedbackPulse.summary}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Channels reviewed</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.channelsReviewed}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer messages</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.customerMessageCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer feedback</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.customerFeedbackMessages}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Tech issues</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.techIssueMessages}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Bug mentions</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.bugMentions}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Feature requests</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.featureRequestMentions}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Churn-risk mentions</div>
                    <div className="mt-1 font-semibold">{founderBrief.feedbackPulse.churnRiskMentions}</div>
                  </div>
                </div>
                {founderBrief.feedbackPulse.highlights.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {founderBrief.feedbackPulse.highlights.map((highlight) => (
                      <div key={`${highlight.postedAt}-${highlight.text}`} className="rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="text-xs text-muted-foreground">
                          {formatReceiptDate(highlight.postedAt)}
                          {highlight.channelName ? ` · #${highlight.channelName}` : ""}
                          {highlight.authorLabel ? ` · ${highlight.authorLabel}` : ""}
                        </div>
                        <p className="mt-1">{highlight.text}</p>
                        {highlight.categories.length > 0 || highlight.channelBucket !== "other" ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {highlight.channelBucket !== "other" ? (
                              <span className="rounded-full bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {feedbackBucketLabel(highlight.channelBucket)}
                              </span>
                            ) : null}
                            {highlight.categories.map((category) => (
                              <span key={category} className="rounded-full bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {category.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="font-medium">Action queue</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the short list a founder should work through next.
              </p>
              <div className="mt-4 space-y-3">
                {founderBrief.actionItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No urgent action items were generated on this sync.
                  </div>
                ) : (
                  founderBrief.actionItems.map((item) => (
                    <div key={item.id} className="rounded-xl bg-muted/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-medium">{item.title}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${priorityClasses(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                      <p className="mt-3 text-sm"><span className="font-medium">Next move:</span> {item.recommendedAction}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
          {isOfficelyWorkspace && slackConnector ? (
            <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Slack intake setup</h3>
                <p className="text-sm text-muted-foreground">
                  This connects Slack for founder intake and customer feedback. During sync, Officely now reviews up to the last year of messages across the channels and direct-message conversations the bot can actually read.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="slack-enabled"
                    checked={slackEnabled}
                    onCheckedChange={(checked) => setSlackEnabled(Boolean(checked))}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="slack-enabled" className="text-sm font-medium leading-none">
                      Enable Slack for this company
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Turn this off if you want to pause Slack intake without deleting the saved tokens.
                    </p>
                  </div>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Slack bot token</span>
                  <Input
                    type="password"
                    value={slackBotToken}
                    onChange={(event) => setSlackBotToken(event.target.value)}
                    placeholder={hasSavedSlackBotToken ? "Saved securely. Paste a new one only if you want to replace it." : "xoxb-..."}
                    disabled={!slackEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedSlackBotToken
                      ? "A bot token is already saved securely. Leave this blank to keep using it."
                      : "This is stored as a secret so it is not saved in plain text."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Slack app token</span>
                  <Input
                    type="password"
                    value={slackAppToken}
                    onChange={(event) => setSlackAppToken(event.target.value)}
                    placeholder={hasSavedSlackAppToken ? "Saved securely. Paste a new one only if you want to replace it." : "xapp-..."}
                    disabled={!slackEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedSlackAppToken
                      ? "An app token is already saved securely. Leave this blank to keep using it."
                      : "Use a Socket Mode app token so the web app layer can keep Slack company-scoped."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Default company channel ID</span>
                  <Input
                    value={slackDefaultChannelId}
                    onChange={(event) => setSlackDefaultChannelId(event.target.value)}
                    placeholder="Optional, for example C0123456789"
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional. Leave blank if this connector should only listen to founder DMs.
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Founder Slack user ID</span>
                  <Input
                    value={slackFounderUserId}
                    onChange={(event) => setSlackFounderUserId(event.target.value)}
                    placeholder="Optional, for example U0123456789"
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional. Save this if you want the connector tied to one founder identity inside Slack.
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Intake mode</span>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={slackIntakeMode}
                    onChange={(event) => setSlackIntakeMode(event.target.value as "dm_only" | "dm_and_channel")}
                  >
                    <option value="dm_only">Founder DMs only</option>
                    <option value="dm_and_channel">Founder DMs and default channel</option>
                  </select>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testSlackSetup.mutate()}
                    disabled={(!slackEnabled || ((!slackBotToken.trim() && !hasSavedSlackBotToken) || (!slackAppToken.trim() && !hasSavedSlackAppToken))) || testSlackSetup.isPending}
                  >
                    {testSlackSetup.isPending ? "Testing..." : "Test Slack"}
                  </Button>
                  <Button
                    onClick={() => saveSlackSetup.mutate()}
                    disabled={saveSlackSetup.isPending}
                  >
                    {saveSlackSetup.isPending ? "Saving..." : "Save Slack setup"}
                  </Button>
                </div>
                {testSlackSetup.error ? (
                  <p className="text-sm text-destructive">{testSlackSetup.error.message}</p>
                ) : null}
                {testSlackSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    {testSlackSetup.data.enabled
                      ? `Slack connection worked. Connected to ${testSlackSetup.data.teamName ?? "your Slack workspace"} with bot ${testSlackSetup.data.botUserName ?? testSlackSetup.data.botUserId ?? "unknown"}. Last checked ${new Date(testSlackSetup.data.checkedAt).toLocaleString()}.`
                      : `Slack is disabled for this company. Saved settings were updated at ${new Date(testSlackSetup.data.checkedAt).toLocaleString()}.`}
                    {testSlackSetup.data.usedSavedBotToken && testSlackSetup.data.usedSavedAppToken
                      ? " Used the saved Slack tokens."
                      : " Used the token values you just pasted for any blank field."}
                  </p>
                ) : null}
                {saveSlackSetup.error ? (
                  <p className="text-sm text-destructive">{saveSlackSetup.error.message}</p>
                ) : null}
                {saveSlackSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    {saveSlackSetup.data.enabled
                      ? `Slack setup verified and saved. Connected to ${saveSlackSetup.data.teamName ?? "your Slack workspace"} and checked at ${new Date(saveSlackSetup.data.checkedAt).toLocaleString()}.`
                      : "Slack setup saved in a disabled state for this company."}
                    {saveSlackSetup.data.defaultChannelId
                      ? ` Default channel: ${saveSlackSetup.data.defaultChannelId}.`
                      : " No default channel is set."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
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
          {isOfficelyWorkspace && xeroConnector ? (
            <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Xero revenue setup</h3>
                <p className="text-sm text-muted-foreground">
                  This reads booked revenue from Xero using a custom connection for Officely’s own finance account. It stays read-only and pulls invoices plus payment clues for likely manual transfers.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Xero client ID</span>
                  <Input
                    type="password"
                    value={xeroClientId}
                    onChange={(event) => setXeroClientId(event.target.value)}
                    placeholder={hasSavedXeroClientId ? "Saved securely. Paste a new one only if you want to replace it." : "Xero custom connection client ID"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedXeroClientId
                      ? "A client ID is already saved securely. Leave this blank to keep using it."
                      : "This is stored as a secret so it is not saved in plain text."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Xero client secret</span>
                  <Input
                    type="password"
                    value={xeroClientSecret}
                    onChange={(event) => setXeroClientSecret(event.target.value)}
                    placeholder={hasSavedXeroClientSecret ? "Saved securely. Paste a new one only if you want to replace it." : "Xero custom connection client secret"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedXeroClientSecret
                      ? "A client secret is already saved securely. Leave this blank to keep using it."
                      : "Use a Xero custom connection for Officely’s own organisation so this stays machine-to-machine and read-only."}
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testXeroSetup.mutate()}
                    disabled={(!xeroClientId.trim() && !hasSavedXeroClientId) || (!xeroClientSecret.trim() && !hasSavedXeroClientSecret) || testXeroSetup.isPending}
                  >
                    {testXeroSetup.isPending ? "Testing..." : "Test Xero"}
                  </Button>
                  <Button
                    onClick={() => saveXeroSetup.mutate()}
                    disabled={(!xeroClientId.trim() && !hasSavedXeroClientId) || (!xeroClientSecret.trim() && !hasSavedXeroClientSecret) || saveXeroSetup.isPending}
                  >
                    {saveXeroSetup.isPending ? "Saving..." : "Save Xero setup"}
                  </Button>
                </div>
                {testXeroSetup.error ? (
                  <p className="text-sm text-destructive">{testXeroSetup.error.message}</p>
                ) : null}
                {testXeroSetup.data?.companyId === selectedCompanyId ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Xero connection worked. Found {testXeroSetup.data.invoiceCount} invoices and {testXeroSetup.data.cashReceiptCount} received-money transactions in the current window.
                      {" "}Stripe USD appears in {testXeroSetup.data.stripeCashReceiptCount} of those cash receipts.
                      {" "}Xero still flagged {testXeroSetup.data.manualPaymentCount} invoice payments as likely manual transfers.
                      {testXeroSetup.data.sampleCompanies.length > 0
                        ? ` Sample companies: ${testXeroSetup.data.sampleCompanies.join(", ")}.`
                        : ""}
                      {testXeroSetup.data.usedSavedClientId && testXeroSetup.data.usedSavedClientSecret
                        ? " Used the saved Xero credentials."
                        : " Used the credentials you just pasted for any blank field."}
                    </p>
                    {testXeroSetup.data.latestStripeCashReceipts.length > 0 ? (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Stripe USD cash receipts</div>
                        <div className="mt-2 space-y-1">
                          {testXeroSetup.data.latestStripeCashReceipts.map((receipt) => (
                            <div key={`${receipt.receivedAt}-${receipt.amount}-${receipt.reference ?? ""}`} className="text-xs text-muted-foreground">
                              {formatReceiptDate(receipt.receivedAt)} · {formatMoney(receipt.amount, receipt.currency)} · {receipt.bankAccountName ?? "Unknown bank account"}
                              {receipt.reference ? ` · ${receipt.reference}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {saveXeroSetup.error ? (
                  <p className="text-sm text-destructive">{saveXeroSetup.error.message}</p>
                ) : null}
                {saveXeroSetup.data?.companyId === selectedCompanyId ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Xero setup verified and saved. Found {saveXeroSetup.data.invoiceCount} invoices and {saveXeroSetup.data.cashReceiptCount} received-money transactions before saving.
                      {" "}Stripe USD appears in {saveXeroSetup.data.stripeCashReceiptCount} of those cash receipts.
                      {" "}Xero still flagged {saveXeroSetup.data.manualPaymentCount} invoice payments as likely manual transfers.
                      {saveXeroSetup.data.sampleCompanies.length > 0
                        ? ` Sample companies: ${saveXeroSetup.data.sampleCompanies.join(", ")}.`
                        : ""}
                      {saveXeroSetup.data.usedSavedClientId && saveXeroSetup.data.usedSavedClientSecret
                        ? " Verified with the saved Xero credentials."
                        : " Verified with the credentials you just pasted for any blank field."}
                    </p>
                    {saveXeroSetup.data.latestStripeCashReceipts.length > 0 ? (
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest Stripe USD cash receipts</div>
                        <div className="mt-2 space-y-1">
                          {saveXeroSetup.data.latestStripeCashReceipts.map((receipt) => (
                            <div key={`${receipt.receivedAt}-${receipt.amount}-${receipt.reference ?? ""}`} className="text-xs text-muted-foreground">
                              {formatReceiptDate(receipt.receivedAt)} · {formatMoney(receipt.amount, receipt.currency)} · {receipt.bankAccountName ?? "Unknown bank account"}
                              {receipt.reference ? ` · ${receipt.reference}` : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {isOfficelyWorkspace && stripeConnector ? (
            <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Stripe billing setup</h3>
                <p className="text-sm text-muted-foreground">
                  This reads recent automated billing events from Stripe, like failed payments, refunds, cancellations, and plan changes. Use a restricted read-only key if you can.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Stripe secret key</span>
                  <Input
                    type="password"
                    value={stripeSecretKey}
                    onChange={(event) => setStripeSecretKey(event.target.value)}
                    placeholder={hasSavedStripeSecretKey ? "Saved securely. Paste a new one only if you want to replace it." : "sk_live_... or rk_live_..."}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedStripeSecretKey
                      ? "A Stripe key is already saved securely. Leave this blank to keep using it."
                      : "This is stored as a secret so it is not saved in plain text. A restricted read-only key is the safest option."}
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testStripeSetup.mutate()}
                    disabled={!stripeSecretKey.trim() && !hasSavedStripeSecretKey || testStripeSetup.isPending}
                  >
                    {testStripeSetup.isPending ? "Testing..." : "Test Stripe"}
                  </Button>
                  <Button
                    onClick={() => saveStripeSetup.mutate()}
                    disabled={!stripeSecretKey.trim() && !hasSavedStripeSecretKey || saveStripeSetup.isPending}
                  >
                    {saveStripeSetup.isPending ? "Saving..." : "Save Stripe setup"}
                  </Button>
                </div>
                {testStripeSetup.error ? (
                  <p className="text-sm text-destructive">{testStripeSetup.error.message}</p>
                ) : null}
                {testStripeSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    Stripe connection worked. Found {testStripeSetup.data.eventCount} billing events in the last 30 days, including {testStripeSetup.data.failedPaymentCount} failed payments, {testStripeSetup.data.refundCount} refunds, {testStripeSetup.data.cancellationCount} cancellations, {testStripeSetup.data.upgradeCount} upgrades, and {testStripeSetup.data.downgradeCount} downgrades.
                    {testStripeSetup.data.sampleCompanies.length > 0
                      ? ` Sample accounts: ${testStripeSetup.data.sampleCompanies.join(", ")}.`
                      : ""}
                    {testStripeSetup.data.usedSavedSecretKey
                      ? " Used the saved Stripe key."
                      : " Used the Stripe key you just pasted."}
                  </p>
                ) : null}
                {saveStripeSetup.error ? (
                  <p className="text-sm text-destructive">{saveStripeSetup.error.message}</p>
                ) : null}
                {saveStripeSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    Stripe setup verified and saved. Found {saveStripeSetup.data.eventCount} billing events before saving, including {saveStripeSetup.data.failedPaymentCount} failed payments, {saveStripeSetup.data.refundCount} refunds, {saveStripeSetup.data.cancellationCount} cancellations, {saveStripeSetup.data.upgradeCount} upgrades, and {saveStripeSetup.data.downgradeCount} downgrades.
                    {saveStripeSetup.data.sampleCompanies.length > 0
                      ? ` Sample accounts: ${saveStripeSetup.data.sampleCompanies.join(", ")}.`
                      : ""}
                    {saveStripeSetup.data.usedSavedSecretKey
                      ? " Verified with the saved Stripe key."
                      : " Verified with the Stripe key you just pasted."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {isOfficelyWorkspace && posthogConnector ? (
            <div className="mt-4 rounded-xl border border-border p-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">PostHog analytics setup</h3>
                <p className="text-sm text-muted-foreground">
                  This verifies the PostHog project connection and shows a simple project-wide usage heartbeat. Company-level account matching can be added later once tracking includes a stable company key.
                </p>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="posthog-enabled"
                    checked={posthogEnabled}
                    onCheckedChange={(checked) => setPosthogEnabled(Boolean(checked))}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="posthog-enabled" className="text-sm font-medium leading-none">
                      Enable PostHog for this company
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Turn this off if you want to pause usage sync without deleting the saved API key.
                    </p>
                  </div>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">PostHog API key</span>
                  <Input
                    type="password"
                    value={posthogApiKey}
                    onChange={(event) => setPosthogApiKey(event.target.value)}
                    placeholder={hasSavedPostHogApiKey ? "Saved securely. Paste a new one only if you want to replace it." : "phx_..."}
                    disabled={!posthogEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    {hasSavedPostHogApiKey
                      ? "A PostHog API key is already saved securely. Leave this blank to keep using it."
                      : "This is stored as a secret so it is not saved in plain text."}
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Project ID</span>
                  <Input
                    value={posthogProjectId}
                    onChange={(event) => setPosthogProjectId(event.target.value)}
                    placeholder="PostHog project ID"
                    disabled={!posthogEnabled}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Base URL</span>
                  <Input
                    value={posthogBaseUrl}
                    onChange={(event) => setPosthogBaseUrl(event.target.value)}
                    placeholder="https://us.posthog.com"
                    disabled={!posthogEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    Use the right PostHog region URL for this project.
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Onboarded event</span>
                  <Input
                    value={posthogOnboardingEvent}
                    onChange={(event) => setPosthogOnboardingEvent(event.target.value)}
                    placeholder="Optional, for example user onboarded"
                    disabled={!posthogEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional. If you set this, the preview will count how many times it fired in the last 30 days.
                  </span>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Important events</span>
                  <Textarea
                    value={posthogImportantEvents}
                    onChange={(event) => setPosthogImportantEvents(event.target.value)}
                    rows={4}
                    placeholder={["report created", "workflow completed", "message sent"].join("\n")}
                    disabled={!posthogEnabled}
                  />
                  <span className="text-xs text-muted-foreground">
                    Optional. One event per line. These are the product moments that matter most to you.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => testPostHogSetup.mutate()}
                    disabled={(!posthogEnabled || ((!posthogApiKey.trim() && !hasSavedPostHogApiKey) || !posthogProjectId.trim())) || testPostHogSetup.isPending}
                  >
                    {testPostHogSetup.isPending ? "Testing..." : "Test PostHog"}
                  </Button>
                  <Button
                    onClick={() => savePostHogSetup.mutate()}
                    disabled={savePostHogSetup.isPending}
                  >
                    {savePostHogSetup.isPending ? "Saving..." : "Save PostHog setup"}
                  </Button>
                </div>
                {testPostHogSetup.error ? (
                  <p className="text-sm text-destructive">{testPostHogSetup.error.message}</p>
                ) : null}
                {testPostHogSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    {testPostHogSetup.data.enabled
                      ? `PostHog connection worked. Found ${testPostHogSetup.data.eventCount} events and ${testPostHogSetup.data.activeUserTotal} active users in the last 30 days. Last checked ${new Date(testPostHogSetup.data.checkedAt).toLocaleString()}.`
                      : `PostHog is disabled for this company. Saved settings were updated at ${new Date(testPostHogSetup.data.checkedAt).toLocaleString()}.`}
                    {testPostHogSetup.data.onboardingEvent
                      ? ` ${testPostHogSetup.data.onboardingEvent} fired ${testPostHogSetup.data.onboardingEventCount} time${testPostHogSetup.data.onboardingEventCount === 1 ? "" : "s"}.`
                      : ""}
                    {testPostHogSetup.data.importantEventCounts.length > 0
                      ? ` Important events: ${testPostHogSetup.data.importantEventCounts.map((item) => `${item.eventName} (${item.count})`).join(", ")}.`
                      : ""}
                    {testPostHogSetup.data.usedSavedApiKey
                      ? " Used the saved PostHog key."
                      : " Used the PostHog key you just pasted."}
                  </p>
                ) : null}
                {savePostHogSetup.error ? (
                  <p className="text-sm text-destructive">{savePostHogSetup.error.message}</p>
                ) : null}
                {savePostHogSetup.data?.companyId === selectedCompanyId ? (
                  <p className="text-sm text-muted-foreground">
                    {savePostHogSetup.data.enabled
                      ? `PostHog setup verified and saved. Found ${savePostHogSetup.data.eventCount} events and ${savePostHogSetup.data.activeUserTotal} active users before saving.`
                      : "PostHog setup saved in a disabled state for this company."}
                    {savePostHogSetup.data.onboardingEvent
                      ? ` ${savePostHogSetup.data.onboardingEvent} fired ${savePostHogSetup.data.onboardingEventCount} time${savePostHogSetup.data.onboardingEventCount === 1 ? "" : "s"}.`
                      : ""}
                    {savePostHogSetup.data.importantEventCounts.length > 0
                      ? ` Important events: ${savePostHogSetup.data.importantEventCounts.map((item) => `${item.eventName} (${item.count})`).join(", ")}.`
                      : ""}
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
              {" "}{syncOfficelyData.counts.xeroCashReceipts} Xero cash receipts, {syncOfficelyData.counts.stripeEvents} Stripe events, and {syncOfficelyData.counts.posthogAccounts} PostHog accounts.
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
                    <div className="mt-1 text-xs text-muted-foreground">
                      {connectorEnabled(connector.configJson) ? "Enabled" : "Disabled"}
                      {formatConnectorTime(connector.configJson.lastCheckedAt)
                        ? ` · Last checked ${formatConnectorTime(connector.configJson.lastCheckedAt)}`
                        : ""}
                      {formatConnectorTime(connector.lastSyncAt)
                        ? ` · Last sync ${formatConnectorTime(connector.lastSyncAt)}`
                        : ""}
                    </div>
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
