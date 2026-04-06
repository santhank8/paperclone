import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  companies,
  companyProfiles,
  createDb,
  createSqlClient,
  companySecrets,
  companySecretVersions,
  customerProfiles,
  dataConnectors,
  insightCards,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { secretService } from "../services/secrets.js";
import { officelyConnectorService } from "../services/officely-connectors.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres Officely connector tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function mockXeroFetch(input: {
  invoices?: unknown[];
  payments?: unknown[];
  bankTransactions?: unknown[];
  tokenStatus?: number;
}) {
  const fetchMock = vi.fn(async (requestUrl: string | URL | Request) => {
    const url = typeof requestUrl === "string"
      ? requestUrl
      : requestUrl instanceof URL
        ? requestUrl.toString()
        : requestUrl.url;

    if (url.includes("identity.xero.com/connect/token")) {
      return input.tokenStatus && input.tokenStatus >= 400
        ? jsonResponse({ error_description: "Bad Xero credentials." }, { status: input.tokenStatus })
        : jsonResponse({ access_token: "xero-access-token" });
    }

    if (url.includes("/Invoices")) {
      const page = new URL(url).searchParams.get("page") ?? "1";
      return jsonResponse({ Invoices: page === "1" ? input.invoices ?? [] : [] });
    }

    if (url.includes("/Payments")) {
      const page = new URL(url).searchParams.get("page") ?? "1";
      return jsonResponse({ Payments: page === "1" ? input.payments ?? [] : [] });
    }

    if (url.includes("/BankTransactions")) {
      const page = new URL(url).searchParams.get("page") ?? "1";
      return jsonResponse({ BankTransactions: page === "1" ? input.bankTransactions ?? [] : [] });
    }

    throw new Error(`Unexpected Xero fetch URL in test: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockStripeFetch(input: {
  events?: unknown[];
  status?: number;
  errorMessage?: string;
}) {
  const fetchMock = vi.fn(async (requestUrl: string | URL | Request) => {
    const url = typeof requestUrl === "string"
      ? requestUrl
      : requestUrl instanceof URL
        ? requestUrl.toString()
        : requestUrl.url;

    if (url.includes("/v1/events")) {
      return input.status && input.status >= 400
        ? jsonResponse({ error: { message: input.errorMessage ?? "Bad Stripe key." } }, { status: input.status })
        : jsonResponse({
            object: "list",
            data: input.events ?? [],
            has_more: false,
          });
    }

    throw new Error(`Unexpected Stripe fetch URL in test: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockSlackFetch(input: {
  authStatus?: number;
  appStatus?: number;
  historyStatus?: number;
  listStatus?: number;
  teamId?: string;
  teamName?: string;
  botUserId?: string;
  botUserName?: string;
  appId?: string;
  authError?: string;
  appError?: string;
  historyError?: string;
  listError?: string;
  channels?: unknown[];
  historyMessages?: unknown[];
}) {
  const fetchMock = vi.fn(async (requestUrl: string | URL | Request) => {
    const url = typeof requestUrl === "string"
      ? requestUrl
      : requestUrl instanceof URL
        ? requestUrl.toString()
        : requestUrl.url;

    if (url.includes("/auth.test")) {
      if (input.authStatus && input.authStatus >= 400) {
        return jsonResponse({ ok: false, error: input.authError ?? "invalid_auth" }, { status: input.authStatus });
      }
      return jsonResponse({
        ok: true,
        team_id: input.teamId ?? "T123",
        team: input.teamName ?? "Officely",
        user_id: input.botUserId ?? "U123",
        user: input.botUserName ?? "officely-bot",
      });
    }

    if (url.includes("/apps.connections.open")) {
      if (input.appStatus && input.appStatus >= 400) {
        return jsonResponse({ ok: false, error: input.appError ?? "invalid_auth" }, { status: input.appStatus });
      }
      return jsonResponse({
        ok: true,
        app_id: input.appId ?? "A123",
        url: "wss://slack.example/socket",
      });
    }

    if (url.includes("/conversations.list")) {
      if (input.listStatus && input.listStatus >= 400) {
        return jsonResponse({ ok: false, error: input.listError ?? "missing_scope" }, { status: input.listStatus });
      }
      return jsonResponse({
        ok: true,
        channels: input.channels ?? [],
        response_metadata: { next_cursor: "" },
      });
    }

    if (url.includes("/conversations.history")) {
      if (input.historyStatus && input.historyStatus >= 400) {
        return jsonResponse({ ok: false, error: input.historyError ?? "missing_scope" }, { status: input.historyStatus });
      }
      return jsonResponse({
        ok: true,
        messages: input.historyMessages ?? [],
      });
    }

    throw new Error(`Unexpected Slack fetch URL in test: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockPostHogFetch(input: {
  activeRows?: unknown[];
  eventRows?: unknown[];
  status?: number;
  errorMessage?: string;
}) {
  const fetchMock = vi.fn(async (_requestUrl: string | URL | Request, init?: RequestInit) => {
    if (!init?.body || typeof init.body !== "string") {
      throw new Error("Expected PostHog query body in test.");
    }

    const parsed = JSON.parse(init.body) as {
      query?: {
        query?: string;
      };
    };
    const query = parsed.query?.query ?? "";

    if (input.status && input.status >= 400) {
      return jsonResponse({ detail: input.errorMessage ?? "Bad PostHog credentials." }, { status: input.status });
    }

    if (query.includes("uniq(distinct_id) AS active_users")) {
      return jsonResponse({ results: input.activeRows ?? [] });
    }

    if (query.includes("GROUP BY event")) {
      return jsonResponse({ results: input.eventRows ?? [] });
    }

    throw new Error(`Unexpected PostHog query in test: ${query}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describeEmbeddedPostgres("officelyConnectorService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof officelyConnectorService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const sourceDbs: Array<Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>> = [];

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-officely-connectors-");
    db = createDb(tempDb.connectionString);
    svc = officelyConnectorService(db);
  }, 20_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await db.delete(insightCards);
    await db.delete(customerProfiles);
    await db.delete(dataConnectors);
    await db.delete(companyProfiles);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(companies);

    while (sourceDbs.length > 0) {
      const sourceDb = sourceDbs.pop();
      await sourceDb?.cleanup();
    }
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("syncs the first Officely slice without crossing company boundaries", async () => {
    const officelyCompanyId = randomUUID();
    const otherCompanyId = randomUUID();

    await db.insert(companies).values([
      {
        id: officelyCompanyId,
        name: "Officely",
        issuePrefix: "OFF",
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Muster",
        issuePrefix: "MUS",
        requireBoardApprovalForNewAgents: false,
      },
    ]);
    await db.insert(companyProfiles).values([
      {
        companyId: officelyCompanyId,
        workspaceKey: "officely",
        stage: "growth",
        primaryGoal: "Run Officely",
        activeCapabilities: [],
        decisionCadence: "daily",
        approvalPolicy: {},
        allowedRepos: [],
        connectedTools: [],
      },
      {
        companyId: otherCompanyId,
        workspaceKey: "muster",
        stage: "discovery",
        primaryGoal: "Run Muster",
        activeCapabilities: [],
        decisionCadence: "weekly",
        approvalPolicy: {},
        allowedRepos: [],
        connectedTools: [],
      },
    ]);

    await db.insert(customerProfiles).values({
      companyId: otherCompanyId,
      companyName: "Acme Ltd",
      primaryEmailDomain: "acme.com",
      internalAccountId: "other-acct",
      attributesJson: {},
    });

    const result = await svc.syncV1Slice(officelyCompanyId, {
      generatedAt: "2026-04-02T00:00:00.000Z",
      internalAccounts: [
        {
          internalAccountId: "acct_1",
          companyName: "Acme Ltd",
          accountName: "Acme",
          workspaceId: "ws_1",
          primaryEmailDomain: "acme.com",
          planName: "Scale",
          accountStatus: "active",
          stripeCustomerId: "cus_1",
          xeroContactId: "xero_1",
          posthogGroupKey: "grp_1",
          firstSeenAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      xeroInvoices: [
        {
          invoiceId: "inv_1",
          contactId: "xero_1",
          amount: 1200,
          currency: "USD",
          status: "paid",
          paymentMethod: "manual bank transfer",
          paidDate: "2026-04-01T00:00:00.000Z",
        },
      ],
      xeroCashReceipts: [],
      stripeEvents: [
        {
          eventId: "evt_1",
          customerId: "cus_1",
          eventType: "payment_failed",
          occurredAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      posthogAccounts: [
        {
          groupKey: "grp_1",
          activeUsers: 0,
          onboardingCompletedAt: "2026-03-15T00:00:00.000Z",
        },
      ],
    });

    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({
      companyId: officelyCompanyId,
      internalAccountId: "acct_1",
      stripeCustomerId: "cus_1",
      xeroContactId: "xero_1",
      posthogGroupKey: "grp_1",
    });
    expect(result.insights.map((insight) => insight.type)).toEqual(expect.arrayContaining([
      "officely_v1_booked_revenue",
      "officely_v1_manual_revenue",
      "officely_v1_billing_events",
      "officely_v1_usage_risk",
    ]));

    const untouchedOtherProfiles = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.companyId, otherCompanyId));
    expect(untouchedOtherProfiles).toHaveLength(1);
    expect(untouchedOtherProfiles[0]?.internalAccountId).toBe("other-acct");

    const syncedConnectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    expect(syncedConnectors).toHaveLength(5);
    expect(syncedConnectors.find((connector) => connector.kind === "slack")?.status).toBe("connected");
    expect(
      syncedConnectors
        .filter((connector) => connector.kind !== "slack")
        .every((connector) => connector.status === "syncing" && connector.lastSyncAt !== null),
    ).toBe(true);

    const profile = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, officelyCompanyId))
      .then((rows) => rows[0] ?? null);
    expect(profile?.operatingSnapshotJson).toMatchObject({
      revenueScorecard: expect.objectContaining({
        periodStart: "2026-03-01T00:00:00.000Z",
      }),
    });
  });

  it("loads internal accounts from a read-only source database query", async () => {
    const officelyCompanyId = randomUUID();
    const sourceDb = await startEmbeddedPostgresTestDatabase("paperclip-officely-source-");
    sourceDbs.push(sourceDb);

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const sourceSql = createSqlClient(sourceDb.connectionString, { max: 1, onnotice: () => {} });
    try {
      await sourceSql.unsafe(`
        create table officely_accounts (
          internal_account_id text not null,
          company_name text not null,
          account_name text,
          workspace_id text,
          primary_email_domain text,
          plan_name text,
          account_status text,
          first_seen_at timestamptz,
          owner_user_id text,
          stripe_customer_id text,
          xero_contact_id text,
          posthog_group_key text,
          user_count integer,
          mrr numeric,
          churn_risk text,
          onboarding_state text
        )
      `);
      await sourceSql.unsafe(`
        insert into officely_accounts (
          internal_account_id,
          company_name,
          account_name,
          workspace_id,
          primary_email_domain,
          plan_name,
          account_status,
          first_seen_at,
          owner_user_id,
          stripe_customer_id,
          xero_contact_id,
          posthog_group_key,
          user_count,
          mrr,
          churn_risk,
          onboarding_state
        ) values
          ('acct_live_1', 'Acme Ltd', 'Acme', 'ws_live_1', 'acme.com', 'Scale', 'active', '2026-03-01T00:00:00Z', 'owner_1', 'cus_live_1', 'xero_live_1', 'grp_live_1', 12, 499, 'low', 'complete'),
          ('acct_live_2', 'Beta LLC', 'Beta', 'ws_live_2', 'beta.io', 'Starter', 'trial', '2026-03-15T00:00:00Z', 'owner_2', null, null, 'grp_live_2', 3, 99, 'medium', 'pending')
      `);
    } finally {
      await sourceSql.end();
    }

    const secret = await secretService(db).create(officelyCompanyId, {
      name: "OFFICELY_INTERNAL_DB_URL",
      provider: "local_encrypted",
      value: sourceDb.connectionString,
    });

    const connectors = await svc.ensureV1Connectors(officelyCompanyId);
    const internalDatabaseConnector = connectors.find((connector) => connector.kind === "internal_database");
    expect(internalDatabaseConnector).toBeTruthy();

    await db
      .update(dataConnectors)
      .set({
        configJson: {
          provider: "internal_database",
          syncMode: "read_only_sql_query",
          connectionSecretId: secret.id,
          sqlQuery: [
            "select",
            "  internal_account_id,",
            "  company_name,",
            "  account_name,",
            "  workspace_id,",
            "  primary_email_domain,",
            "  plan_name,",
            "  account_status,",
            "  first_seen_at,",
            "  owner_user_id,",
            "  stripe_customer_id,",
            "  xero_contact_id,",
            "  posthog_group_key,",
            "  user_count,",
            "  mrr,",
            "  churn_risk,",
            "  onboarding_state",
            "from officely_accounts",
            "order by internal_account_id",
          ].join("\n"),
        },
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, internalDatabaseConnector!.id));

    const result = await svc.syncV1FromConnectors(officelyCompanyId);

    expect(result.counts).toEqual({
      internalAccounts: 2,
      xeroInvoices: 0,
      xeroCashReceipts: 0,
      stripeEvents: 0,
      posthogAccounts: 0,
    });
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles.map((profile) => profile.internalAccountId)).toEqual(["acct_live_1", "acct_live_2"]);
    expect(result.profiles[0]).toMatchObject({
      companyId: officelyCompanyId,
      companyName: "Acme Ltd",
      stripeCustomerId: "cus_live_1",
      xeroContactId: "xero_live_1",
      posthogGroupKey: "grp_live_1",
    });

    const syncedConnectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    expect(syncedConnectors.find((connector) => connector.kind === "internal_database")?.status).toBe("syncing");
    expect(syncedConnectors.find((connector) => connector.kind === "xero")?.status).toBe("planned");
  });

  it("saves internal database setup and previews accounts using the saved secret", async () => {
    const officelyCompanyId = randomUUID();
    const sourceDb = await startEmbeddedPostgresTestDatabase("paperclip-officely-setup-source-");
    sourceDbs.push(sourceDb);

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const sourceSql = createSqlClient(sourceDb.connectionString, { max: 1, onnotice: () => {} });
    try {
      await sourceSql.unsafe(`
        create table customer_accounts (
          internal_account_id text not null,
          company_name text not null,
          primary_email_domain text
        )
      `);
      await sourceSql.unsafe(`
        insert into customer_accounts (internal_account_id, company_name, primary_email_domain)
        values
          ('acct_saved_1', 'Acme Ltd', 'acme.com'),
          ('acct_saved_2', 'Beta LLC', 'beta.io')
      `);
    } finally {
      await sourceSql.end();
    }

    const setup = await svc.saveInternalDatabaseSetup(officelyCompanyId, {
      connectionString: sourceDb.connectionString,
      sqlQuery: [
        "select",
        "  internal_account_id,",
        "  company_name,",
        "  primary_email_domain",
        "from customer_accounts",
        "order by internal_account_id",
      ].join("\n"),
    });

    expect(setup).toMatchObject({
      companyId: officelyCompanyId,
      secretName: "OFFICELY_INTERNAL_DATABASE_URL",
      hasSavedConnection: true,
      queryConfigured: true,
    });

    const savedSecret = await secretService(db).getByName(officelyCompanyId, "OFFICELY_INTERNAL_DATABASE_URL");
    expect(savedSecret).toBeTruthy();

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    const internalDatabaseConnector = connectors.find((connector) => connector.kind === "internal_database");
    expect(internalDatabaseConnector?.configJson).toMatchObject({
      connectionSecretId: savedSecret?.id,
      syncMode: "read_only_sql_query",
    });

    const preview = await svc.testInternalDatabaseSetup(officelyCompanyId, {
      sqlQuery: [
        "select",
        "  internal_account_id,",
        "  company_name,",
        "  primary_email_domain",
        "from customer_accounts",
        "order by internal_account_id",
      ].join("\n"),
    });

    expect(preview).toEqual({
      companyId: officelyCompanyId,
      accountCount: 2,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      usedSavedConnection: true,
    });
  });

  it("saves Xero setup and previews invoices using the saved credentials", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_xero_1",
          Type: "ACCREC",
          Status: "PAID",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-03-20T00:00:00Z",
          Contact: {
            ContactID: "contact_xero_1",
            Name: "Acme Ltd",
            EmailAddress: "finance@acme.com",
          },
        },
        {
          InvoiceID: "inv_xero_2",
          Type: "ACCREC",
          Status: "PAID",
          Total: 499,
          CurrencyCode: "USD",
          DateString: "2026-03-22T00:00:00Z",
          Contact: {
            ContactID: "contact_xero_2",
            Name: "Beta LLC",
            EmailAddress: "ops@beta.io",
          },
        },
      ],
      payments: [
        {
          Invoice: { InvoiceID: "inv_xero_1" },
          Account: { Name: "Operating Bank" },
          Reference: "manual bank transfer",
          Date: "2026-03-21T00:00:00Z",
        },
        {
          Invoice: { InvoiceID: "inv_xero_2" },
          Account: { Name: "Stripe Clearing" },
          Reference: "stripe payout",
          Date: "2026-03-23T00:00:00Z",
        },
      ],
    });

    const setup = await svc.saveXeroSetup(officelyCompanyId, {
      clientId: "xero-client-id",
      clientSecret: "xero-client-secret",
    });

    expect(setup).toMatchObject({
      companyId: officelyCompanyId,
      hasSavedClientId: true,
      hasSavedClientSecret: true,
      invoiceCount: 2,
      cashReceiptCount: 0,
      stripeCashReceiptCount: 0,
      manualPaymentCount: 1,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      latestStripeCashReceipts: [],
      usedSavedClientId: false,
      usedSavedClientSecret: false,
    });

    const savedClientId = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_ID");
    const savedClientSecret = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_SECRET");
    expect(savedClientId).toBeTruthy();
    expect(savedClientSecret).toBeTruthy();

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    const xeroConnector = connectors.find((connector) => connector.kind === "xero");
    expect(xeroConnector?.configJson).toMatchObject({
      provider: "xero_custom_connection",
      clientIdSecretId: savedClientId?.id,
      clientSecretSecretId: savedClientSecret?.id,
      syncMode: "client_credentials",
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_xero_1",
          Type: "ACCREC",
          Status: "PAID",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-03-20T00:00:00Z",
          Contact: {
            ContactID: "contact_xero_1",
            Name: "Acme Ltd",
            EmailAddress: "finance@acme.com",
          },
        },
      ],
      payments: [
        {
          Invoice: { InvoiceID: "inv_xero_1" },
          Account: { Name: "Operating Bank" },
          Reference: "manual bank transfer",
          Date: "2026-03-21T00:00:00Z",
        },
      ],
    });

    const preview = await svc.testXeroSetup(officelyCompanyId, {});

    expect(preview).toEqual({
      companyId: officelyCompanyId,
      invoiceCount: 1,
      cashReceiptCount: 0,
      stripeCashReceiptCount: 0,
      manualPaymentCount: 1,
      sampleCompanies: ["Acme Ltd"],
      latestStripeCashReceipts: [],
      usedSavedClientId: true,
      usedSavedClientSecret: true,
    });
  });

  it("syncs live Xero invoices from connector credentials", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_sync_1",
          Type: "ACCREC",
          Status: "PAID",
          Total: 1500,
          CurrencyCode: "USD",
          DateString: "2026-04-02T00:00:00Z",
          Contact: {
            ContactID: "contact_sync_1",
            Name: "Acme Ltd",
            EmailAddress: "finance@acme.com",
          },
        },
      ],
      payments: [
        {
          Invoice: { InvoiceID: "inv_sync_1" },
          Account: { Name: "Operating Bank" },
          Reference: "manual bank transfer",
          Date: "2026-04-02T00:00:00Z",
        },
      ],
    });

    await svc.saveXeroSetup(officelyCompanyId, {
      clientId: "xero-client-id",
      clientSecret: "xero-client-secret",
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_sync_1",
          Type: "ACCREC",
          Status: "PAID",
          Total: 1500,
          CurrencyCode: "USD",
          DateString: "2026-04-02T00:00:00Z",
          Contact: {
            ContactID: "contact_sync_1",
            Name: "Acme Ltd",
            EmailAddress: "finance@acme.com",
          },
        },
      ],
      payments: [
        {
          Invoice: { InvoiceID: "inv_sync_1" },
          Account: { Name: "Operating Bank" },
          Reference: "manual bank transfer",
          Date: "2026-04-02T00:00:00Z",
        },
      ],
    });

    const result = await svc.syncV1FromConnectors(officelyCompanyId);

    expect(result.counts).toEqual({
      internalAccounts: 0,
      xeroInvoices: 1,
      xeroCashReceipts: 0,
      stripeEvents: 0,
      posthogAccounts: 0,
    });
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({
      companyId: officelyCompanyId,
      companyName: "Acme Ltd",
      xeroContactId: "contact_sync_1",
      primaryEmailDomain: "acme.com",
    });
    expect(result.insights.map((insight) => insight.type)).toEqual(expect.arrayContaining([
      "officely_v1_booked_revenue",
      "officely_v1_manual_revenue",
    ]));

    const syncedConnectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    expect(syncedConnectors.find((connector) => connector.kind === "xero")?.status).toBe("syncing");
  });

  it("captures Stripe USD received-money transactions from the Xero bank feed", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
      operatingSnapshotJson: {},
    });

    mockXeroFetch({
      invoices: [],
      payments: [],
      bankTransactions: [
        {
          BankTransactionID: "bank_txn_1",
          Type: "RECEIVE",
          DateString: "2026-03-25T00:00:00Z",
          Total: 2400,
          CurrencyCode: "USD",
          Reference: "Stripe payout",
          Contact: {
            Name: "Stripe platform",
          },
          BankAccount: {
            Name: "Stripe USD",
          },
          LineItems: [
            {
              Description: "Stripe Sales",
            },
          ],
        },
      ],
    });

    await svc.saveXeroSetup(officelyCompanyId, {
      clientId: "xero-client-id",
      clientSecret: "xero-client-secret",
    });

    const result = await svc.syncV1FromConnectors(officelyCompanyId);

    expect(result.counts).toEqual({
      internalAccounts: 0,
      xeroInvoices: 0,
      xeroCashReceipts: 1,
      stripeEvents: 0,
      posthogAccounts: 0,
    });

    const profile = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, officelyCompanyId))
      .then((rows) => rows[0]);

    expect(profile?.operatingSnapshotJson).toMatchObject({
      revenueScorecard: {
        currency: "USD",
        collectedRevenue: 2400,
        collectedViaStripe: 2400,
        collectedManually: 0,
        collectedOther: 0,
      },
    });
  });

  it("monthlyizes annual Xero invoices before saving the revenue scorecard snapshot", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      operatingSnapshotJson: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_annual_prev",
          Type: "ACCREC",
          Status: "PAID",
          Reference: "Annual plan",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-02-02T00:00:00Z",
          Contact: {
            ContactID: "contact_annual",
            Name: "Annual Co",
            EmailAddress: "finance@annual.co",
          },
          LineItems: [
            {
              Description: "Annual subscription",
            },
          ],
        },
        {
          InvoiceID: "inv_annual_curr",
          Type: "ACCREC",
          Status: "PAID",
          Reference: "Annual plan renewal",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-03-02T00:00:00Z",
          Contact: {
            ContactID: "contact_annual",
            Name: "Annual Co",
            EmailAddress: "finance@annual.co",
          },
          LineItems: [
            {
              Description: "Annual subscription",
            },
          ],
        },
      ],
      payments: [],
    });

    await svc.saveXeroSetup(officelyCompanyId, {
      clientId: "xero-client-id",
      clientSecret: "xero-client-secret",
    });

    mockXeroFetch({
      invoices: [
        {
          InvoiceID: "inv_annual_prev",
          Type: "ACCREC",
          Status: "PAID",
          Reference: "Annual plan",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-02-02T00:00:00Z",
          Contact: {
            ContactID: "contact_annual",
            Name: "Annual Co",
            EmailAddress: "finance@annual.co",
          },
          LineItems: [
            {
              Description: "Annual subscription",
            },
          ],
        },
        {
          InvoiceID: "inv_annual_curr",
          Type: "ACCREC",
          Status: "PAID",
          Reference: "Annual plan renewal",
          Total: 1200,
          CurrencyCode: "USD",
          DateString: "2026-03-02T00:00:00Z",
          Contact: {
            ContactID: "contact_annual",
            Name: "Annual Co",
            EmailAddress: "finance@annual.co",
          },
          LineItems: [
            {
              Description: "Annual subscription",
            },
          ],
        },
      ],
      payments: [],
    });

    await svc.syncV1FromConnectors(officelyCompanyId);

    const profile = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, officelyCompanyId))
      .then((rows) => rows[0] ?? null);

    expect(profile?.operatingSnapshotJson).toMatchObject({
      revenueScorecard: expect.objectContaining({
        currentMrr: 100,
        previousMrr: 100,
        overallChange: 0,
      }),
    });
  });

  it("saves Stripe setup and previews billing events using the saved key", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_fail_1",
          type: "invoice.payment_failed",
          created: 1_775_174_400,
          data: {
            object: {
              customer: "cus_acme",
              customer_name: "Acme Ltd",
              customer_email: "finance@acme.com",
              amount_due: 120000,
              items: {
                data: [
                  {
                    price: {
                      nickname: "Scale",
                      unit_amount: 120000,
                    },
                  },
                ],
              },
            },
          },
        },
        {
          id: "evt_upgrade_1",
          type: "customer.subscription.updated",
          created: 1_775_260_800,
          data: {
            object: {
              customer: "cus_acme",
              items: {
                data: [
                  {
                    price: {
                      nickname: "Scale",
                      unit_amount: 150000,
                    },
                    quantity: 1,
                  },
                ],
              },
              metadata: {
                company_name: "Acme Ltd",
              },
            },
            previous_attributes: {
              items: {
                data: [
                  {
                    price: {
                      unit_amount: 120000,
                    },
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
        {
          id: "evt_refund_1",
          type: "charge.refunded",
          created: 1_775_347_200,
          data: {
            object: {
              customer: "cus_beta",
              amount_refunded: 4500,
              billing_details: {
                name: "Beta LLC",
                email: "ops@beta.io",
              },
            },
          },
        },
      ],
    });

    const setup = await svc.saveStripeSetup(officelyCompanyId, {
      secretKey: "rk_live_officely",
    });

    expect(setup).toMatchObject({
      companyId: officelyCompanyId,
      hasSavedSecretKey: true,
      eventCount: 3,
      failedPaymentCount: 1,
      refundCount: 1,
      cancellationCount: 0,
      upgradeCount: 1,
      downgradeCount: 0,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      usedSavedSecretKey: false,
    });

    const savedSecret = await secretService(db).getByName(officelyCompanyId, "OFFICELY_STRIPE_SECRET_KEY");
    expect(savedSecret).toBeTruthy();

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    const stripeConnector = connectors.find((connector) => connector.kind === "stripe");
    expect(stripeConnector?.configJson).toMatchObject({
      provider: "stripe_events_api",
      secretKeySecretId: savedSecret?.id,
      syncMode: "rest_api",
      eventLookbackDays: 30,
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_cancel_1",
          type: "customer.subscription.deleted",
          created: 1_775_433_600,
          data: {
            object: {
              customer: "cus_gamma",
              metadata: {
                company_name: "Gamma Inc",
              },
              items: {
                data: [
                  {
                    price: {
                      nickname: "Starter",
                      unit_amount: 5000,
                    },
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      ],
    });

    const preview = await svc.testStripeSetup(officelyCompanyId, {});

    expect(preview).toEqual({
      companyId: officelyCompanyId,
      eventCount: 1,
      failedPaymentCount: 0,
      refundCount: 0,
      cancellationCount: 1,
      upgradeCount: 0,
      downgradeCount: 0,
      sampleCompanies: ["Gamma Inc"],
      usedSavedSecretKey: true,
    });
  });

  it("syncs live Stripe billing events from connector credentials", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_sync_fail",
          type: "invoice.payment_failed",
          created: 1_775_174_400,
          data: {
            object: {
              customer: "cus_sync",
              customer_name: "Acme Ltd",
              customer_email: "finance@acme.com",
              amount_due: 120000,
            },
          },
        },
        {
          id: "evt_sync_cancel",
          type: "customer.subscription.deleted",
          created: 1_775_260_800,
          data: {
            object: {
              customer: "cus_sync",
              metadata: {
                company_name: "Acme Ltd",
              },
              items: {
                data: [
                  {
                    price: {
                      nickname: "Scale",
                      unit_amount: 120000,
                    },
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      ],
    });

    await svc.saveStripeSetup(officelyCompanyId, {
      secretKey: "rk_live_officely",
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_sync_fail",
          type: "invoice.payment_failed",
          created: 1_775_174_400,
          data: {
            object: {
              customer: "cus_sync",
              customer_name: "Acme Ltd",
              customer_email: "finance@acme.com",
              amount_due: 120000,
            },
          },
        },
        {
          id: "evt_sync_cancel",
          type: "customer.subscription.deleted",
          created: 1_775_260_800,
          data: {
            object: {
              customer: "cus_sync",
              metadata: {
                company_name: "Acme Ltd",
              },
              items: {
                data: [
                  {
                    price: {
                      nickname: "Scale",
                      unit_amount: 120000,
                    },
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      ],
    });

    const result = await svc.syncV1FromConnectors(officelyCompanyId);

    expect(result.counts).toEqual({
      internalAccounts: 0,
      xeroInvoices: 0,
      xeroCashReceipts: 0,
      stripeEvents: 2,
      posthogAccounts: 0,
    });
    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]).toMatchObject({
      companyId: officelyCompanyId,
      companyName: "Acme Ltd",
      stripeCustomerId: "cus_sync",
      primaryEmailDomain: "acme.com",
    });
    expect(result.insights.map((insight) => insight.type)).toEqual(expect.arrayContaining([
      "officely_v1_billing_events",
    ]));

    const syncedConnectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    expect(syncedConnectors.find((connector) => connector.kind === "stripe")?.status).toBe("syncing");
  });

  it("stores a founder brief from Stripe, PostHog, and Slack during sync", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_setup_paid",
          type: "invoice.paid",
          created: 1_774_281_600,
          data: {
            object: {
              customer: "cus_founder",
              customer_name: "Foundry Co",
              customer_email: "finance@foundry.co",
              amount_paid: 500000,
            },
          },
        },
      ],
    });
    await svc.saveStripeSetup(officelyCompanyId, {
      secretKey: "rk_live_founder",
    });

    mockSlackFetch({
      teamId: "T123",
      teamName: "Officely",
      botUserId: "U123",
      botUserName: "officely-bot",
      appId: "A123",
    });
    await svc.saveSlackSetup(officelyCompanyId, {
      enabled: true,
      botToken: "xoxb-valid",
      appToken: "xapp-valid",
      defaultChannelId: "CFEEDBACK",
      founderUserId: "UCEO",
      intakeMode: "dm_and_channel",
    });

    mockPostHogFetch({
      activeRows: [{ event_count: 120, active_users: 24 }],
      eventRows: [
        { event: "onboarding_completed", event_count: 0 },
        { event: "room_booked", event_count: 8 },
      ],
    });
    await svc.savePostHogSetup(officelyCompanyId, {
      enabled: true,
      apiKey: "phx_test",
      projectId: "20147",
      baseUrl: "https://eu.i.posthog.com",
      onboardingEvent: "onboarding_completed",
      importantEvents: ["room_booked"],
    });

    const syncFetch = vi.fn(async (requestUrl: string | URL | Request, init?: RequestInit) => {
      const url = typeof requestUrl === "string"
        ? requestUrl
        : requestUrl instanceof URL
          ? requestUrl.toString()
          : requestUrl.url;

      if (url.includes("/v1/events")) {
        return jsonResponse({
          object: "list",
          data: [
            {
              id: "evt_sync_paid",
              type: "invoice.paid",
              created: 1_774_281_600,
              data: {
                object: {
                  customer: "cus_founder",
                  customer_name: "Foundry Co",
                  customer_email: "finance@foundry.co",
                  amount_paid: 500000,
                },
              },
            },
            {
              id: "evt_sync_failed",
              type: "invoice.payment_failed",
              created: 1_775_174_400,
              data: {
                object: {
                  customer: "cus_founder",
                  customer_name: "Foundry Co",
                  customer_email: "finance@foundry.co",
                  amount_due: 180000,
                },
              },
            },
          ],
          has_more: false,
        });
      }

      if (url.includes("/conversations.list")) {
        return jsonResponse({
          ok: true,
          channels: [
            {
              id: "CFEEDBACK",
              name: "customer-feedback",
              is_member: true,
            },
            {
              id: "CPRODUCT",
              name: "tech-issues",
              is_member: true,
            },
          ],
          response_metadata: { next_cursor: "" },
        });
      }

      if (url.includes("/conversations.history")) {
        const channel = new URL(url).searchParams.get("channel");
        return jsonResponse({
          ok: true,
          messages: channel === "CFEEDBACK"
            ? [
                {
                  ts: "1775174400",
                  user: "U111",
                  text: "This booking bug is painful and we might cancel if it keeps happening.",
                },
              ]
            : [
                {
                  ts: "1775088000",
                  user: "U222",
                  text: "The desk booking page is broken for Android users.",
                },
              ],
        });
      }

      if (url.includes("/query/")) {
        if (!init?.body || typeof init.body !== "string") throw new Error("Expected PostHog body.");
        const parsed = JSON.parse(init.body) as { query?: { query?: string } };
        const query = parsed.query?.query ?? "";
        if (query.includes("uniq(distinct_id) AS active_users")) {
          return jsonResponse({ results: [{ event_count: 120, active_users: 24 }] });
        }
        if (query.includes("GROUP BY event")) {
          return jsonResponse({ results: [{ event: "onboarding_completed", event_count: 0 }, { event: "room_booked", event_count: 8 }] });
        }
      }

      if (url.includes("/Invoices")) return jsonResponse({ Invoices: [] });
      if (url.includes("/Payments")) return jsonResponse({ Payments: [] });
      if (url.includes("/BankTransactions")) return jsonResponse({ BankTransactions: [] });

      throw new Error(`Unexpected fetch URL in founder brief sync test: ${url}`);
    });
    vi.stubGlobal("fetch", syncFetch);

    await svc.syncV1FromConnectors(officelyCompanyId);

    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, officelyCompanyId));

    const snapshot = profile.operatingSnapshotJson as {
      founderBrief?: {
        headline?: string;
        productPulse?: { status?: string };
        feedbackPulse?: { status?: string; churnRiskMentions?: number; customerFeedbackMessages?: number; techIssueMessages?: number };
        actionItems?: Array<{ id?: string }>;
      };
    };

    expect(snapshot.founderBrief?.headline).toBe("Customer pain needs attention now.");
    expect(snapshot.founderBrief?.productPulse?.status).toBe("watch");
    expect(snapshot.founderBrief?.feedbackPulse?.status).toBe("risk");
    expect(snapshot.founderBrief?.feedbackPulse?.churnRiskMentions).toBe(1);
    expect(snapshot.founderBrief?.feedbackPulse?.customerFeedbackMessages).toBe(1);
    expect(snapshot.founderBrief?.feedbackPulse?.techIssueMessages).toBe(1);
    expect(snapshot.founderBrief?.actionItems?.map((item) => item.id)).toEqual(expect.arrayContaining([
      "revenue_failed_payments",
      "feedback_churn_risk",
      "product_usage_watch",
    ]));
  });

  it("writes a local Officely knowledge snapshot file after sync", async () => {
    const tempKnowledgeDir = mkdtempSync(path.join(os.tmpdir(), "paperclip-kb-"));
    const previousKnowledgeDir = process.env.PAPERCLIP_COMPANY_KB_DIR;
    process.env.PAPERCLIP_COMPANY_KB_DIR = tempKnowledgeDir;

    try {
      const officelyCompanyId = randomUUID();

      await db.insert(companies).values({
        id: officelyCompanyId,
        name: "Officely",
        issuePrefix: "OFF",
        requireBoardApprovalForNewAgents: false,
      });
      await db.insert(companyProfiles).values({
        companyId: officelyCompanyId,
        workspaceKey: "officely",
        stage: "growth",
        primaryGoal: "Run Officely",
        activeCapabilities: [],
        decisionCadence: "weekly",
        approvalPolicy: {},
        operatingSnapshotJson: {},
        allowedRepos: [],
        connectedTools: [],
      });

      mockStripeFetch({
        events: [
          {
            id: "evt_export_1",
            type: "invoice.payment_succeeded",
            created: 1_775_174_400,
            data: {
              object: {
                customer: "cus_export",
                customer_name: "Export Co",
                customer_email: "finance@export.example",
                amount_paid: 49900,
              },
            },
          },
        ],
      });

      await svc.saveStripeSetup(officelyCompanyId, {
        secretKey: "sk_live_test",
      });

      const result = await svc.syncV1FromConnectors(officelyCompanyId);

      expect(result.knowledgeSnapshot?.latestRelativePath).toEqual(
        expect.stringContaining("latest-officely-sync-snapshot.json"),
      );

      const latestSnapshotPath = path.join(
        tempKnowledgeDir,
        "companies",
        "officely",
        "raw",
        "sources",
        "app-db",
        "latest-officely-sync-snapshot.json",
      );
      const exported = JSON.parse(readFileSync(latestSnapshotPath, "utf8")) as {
        company: { name: string; workspaceKey: string | null };
        counts: { stripeEvents: number; customerProfiles: number };
        connectorStatuses: Array<{ kind: string; status: string }>;
        syncPayload: { stripeEvents: unknown[] };
      };

      expect(exported.company).toMatchObject({
        name: "Officely",
        workspaceKey: "officely",
      });
      expect(exported.counts.stripeEvents).toBe(result.counts.stripeEvents);
      expect(exported.counts.customerProfiles).toBe(result.profiles.length);
      expect(exported.connectorStatuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "stripe" }),
        ]),
      );
      expect(exported.syncPayload.stripeEvents).toHaveLength(result.counts.stripeEvents);
    } finally {
      if (previousKnowledgeDir === undefined) {
        delete process.env.PAPERCLIP_COMPANY_KB_DIR;
      } else {
        process.env.PAPERCLIP_COMPANY_KB_DIR = previousKnowledgeDir;
      }
      rmSync(tempKnowledgeDir, { recursive: true, force: true });
    }
  });

  it("saves Slack setup and previews workspace identity using the saved tokens", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockSlackFetch({
      teamId: "T999",
      teamName: "Officely HQ",
      botUserId: "U999",
      botUserName: "virtual-org-bot",
      appId: "A999",
    });

    const setup = await svc.saveSlackSetup(officelyCompanyId, {
      enabled: true,
      botToken: "xoxb-demo",
      appToken: "xapp-demo",
      defaultChannelId: "C123",
      founderUserId: "UCEO",
      intakeMode: "dm_and_channel",
    });

    expect(setup).toMatchObject({
      companyId: officelyCompanyId,
      enabled: true,
      hasSavedBotToken: true,
      hasSavedAppToken: true,
      teamId: "T999",
      teamName: "Officely HQ",
      botUserId: "U999",
      botUserName: "virtual-org-bot",
      appId: "A999",
      defaultChannelId: "C123",
      founderUserId: "UCEO",
      intakeMode: "dm_and_channel",
      usedSavedBotToken: false,
      usedSavedAppToken: false,
    });

    const savedBotToken = await secretService(db).getByName(officelyCompanyId, "OFFICELY_SLACK_BOT_TOKEN");
    const savedAppToken = await secretService(db).getByName(officelyCompanyId, "OFFICELY_SLACK_APP_TOKEN");
    expect(savedBotToken).toBeTruthy();
    expect(savedAppToken).toBeTruthy();

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    const slackConnector = connectors.find((connector) => connector.kind === "slack");
    expect(slackConnector?.status).toBe("connected");
    expect(slackConnector?.configJson).toMatchObject({
      provider: "slack_socket_mode",
      enabled: true,
      botTokenSecretId: savedBotToken?.id,
      appTokenSecretId: savedAppToken?.id,
      teamId: "T999",
      teamName: "Officely HQ",
      botUserId: "U999",
      appId: "A999",
      defaultChannelId: "C123",
      founderUserId: "UCEO",
      intakeMode: "dm_and_channel",
    });

    mockSlackFetch({
      teamId: "T999",
      teamName: "Officely HQ",
      botUserId: "U999",
      botUserName: "virtual-org-bot",
      appId: "A999",
    });

    const preview = await svc.testSlackSetup(officelyCompanyId, {
      enabled: true,
      intakeMode: "dm_only",
    });

    expect(preview).toMatchObject({
      companyId: officelyCompanyId,
      enabled: true,
      teamId: "T999",
      teamName: "Officely HQ",
      botUserId: "U999",
      botUserName: "virtual-org-bot",
      appId: "A999",
      intakeMode: "dm_only",
      usedSavedBotToken: true,
      usedSavedAppToken: true,
    });
  });

  it("saves PostHog setup, previews project health, and leaves company sync untouched", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockPostHogFetch({
      activeRows: [
        { event_count: 42, active_users: 18 },
      ],
      eventRows: [
        { event: "user onboarded", event_count: 6 },
        { event: "report created", event_count: 12 },
        { event: "workflow completed", event_count: 8 },
      ],
    });

    const setup = await svc.savePostHogSetup(officelyCompanyId, {
      enabled: true,
      apiKey: "phx-demo",
      projectId: "12345",
      baseUrl: "https://us.posthog.com",
      onboardingEvent: "user onboarded",
      importantEvents: ["report created", "workflow completed"],
    });

    expect(setup).toMatchObject({
      companyId: officelyCompanyId,
      enabled: true,
      hasSavedApiKey: true,
      projectId: "12345",
      baseUrl: "https://us.posthog.com",
      eventCount: 42,
      activeUserTotal: 18,
      onboardingEvent: "user onboarded",
      onboardingEventCount: 6,
      importantEvents: ["report created", "workflow completed"],
      usedSavedApiKey: false,
    });
    expect(setup.importantEventCounts).toEqual([
      { eventName: "report created", count: 12 },
      { eventName: "workflow completed", count: 8 },
    ]);

    const savedApiKey = await secretService(db).getByName(officelyCompanyId, "OFFICELY_POSTHOG_API_KEY");
    expect(savedApiKey).toBeTruthy();

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    const posthogConnector = connectors.find((connector) => connector.kind === "posthog");
    expect(posthogConnector?.status).toBe("connected");
    expect(posthogConnector?.configJson).toMatchObject({
      provider: "posthog_hogql",
      enabled: true,
      apiKeySecretId: savedApiKey?.id,
      projectId: "12345",
      baseUrl: "https://us.posthog.com",
      onboardingEvent: "user onboarded",
      importantEvents: ["report created", "workflow completed"],
      activityWindowDays: 30,
    });

    mockPostHogFetch({
      activeRows: [
        { event_count: 17, active_users: 9 },
      ],
      eventRows: [
        { event: "user onboarded", event_count: 3 },
        { event: "report created", event_count: 4 },
        { event: "workflow completed", event_count: 2 },
      ],
    });

    const preview = await svc.testPostHogSetup(officelyCompanyId, {
      enabled: true,
      projectId: "12345",
      onboardingEvent: "user onboarded",
      importantEvents: ["report created", "workflow completed"],
    });

    expect(preview).toMatchObject({
      companyId: officelyCompanyId,
      enabled: true,
      projectId: "12345",
      eventCount: 17,
      activeUserTotal: 9,
      onboardingEvent: "user onboarded",
      onboardingEventCount: 3,
      importantEvents: ["report created", "workflow completed"],
      usedSavedApiKey: true,
    });
    expect(preview.importantEventCounts).toEqual([
      { eventName: "report created", count: 4 },
      { eventName: "workflow completed", count: 2 },
    ]);

    mockPostHogFetch({
      activeRows: [
        { event_count: 17, active_users: 9 },
      ],
      eventRows: [
        { event: "user onboarded", event_count: 3 },
        { event: "report created", event_count: 4 },
        { event: "workflow completed", event_count: 2 },
      ],
    });

    const result = await svc.syncV1FromConnectors(officelyCompanyId);

    expect(result.counts).toEqual({
      internalAccounts: 0,
      xeroInvoices: 0,
      xeroCashReceipts: 0,
      stripeEvents: 0,
      posthogAccounts: 0,
    });
    expect(result.profiles).toHaveLength(0);
  });

  it("rejects unsafe internal database queries before they run", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const secret = await secretService(db).create(officelyCompanyId, {
      name: "OFFICELY_INTERNAL_DB_URL",
      provider: "local_encrypted",
      value: "postgres://example.com/officely",
    });

    const connectors = await svc.ensureV1Connectors(officelyCompanyId);
    const internalDatabaseConnector = connectors.find((connector) => connector.kind === "internal_database");
    expect(internalDatabaseConnector).toBeTruthy();

    await db
      .update(dataConnectors)
      .set({
        configJson: {
          provider: "internal_database",
          syncMode: "read_only_sql_query",
          connectionSecretId: secret.id,
          sqlQuery: "delete from officely_accounts",
        },
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, internalDatabaseConnector!.id));

    await expect(svc.syncV1FromConnectors(officelyCompanyId)).rejects.toThrow(
      "Internal database query must start with SELECT.",
    );
  });

  it("rejects Officely sync for non-Officely companies", async () => {
    const musterCompanyId = randomUUID();

    await db.insert(companies).values({
      id: musterCompanyId,
      name: "Muster",
      issuePrefix: "MUS",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: musterCompanyId,
      workspaceKey: "muster",
      stage: "discovery",
      primaryGoal: "Run Muster",
      activeCapabilities: [],
      decisionCadence: "weekly",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    await expect(
      svc.syncV1Slice(musterCompanyId, {
        generatedAt: "2026-04-02T00:00:00.000Z",
        internalAccounts: [],
        xeroInvoices: [],
        xeroCashReceipts: [],
        stripeEvents: [],
        posthogAccounts: [],
      }),
    ).rejects.toThrow("Officely sync is only available for the Officely workspace.");

    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, musterCompanyId));
    expect(connectors).toHaveLength(0);
  });

  it("preserves the last working saved secret when a replacement connection fails verification", async () => {
    const officelyCompanyId = randomUUID();
    const sourceDb = await startEmbeddedPostgresTestDatabase("paperclip-officely-secret-preserve-");
    sourceDbs.push(sourceDb);

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely Ltd",
      issuePrefix: "OFC",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const sourceSql = createSqlClient(sourceDb.connectionString, { max: 1, onnotice: () => {} });
    try {
      await sourceSql.unsafe(`
        create table customer_accounts (
          internal_account_id text not null,
          company_name text not null
        )
      `);
      await sourceSql.unsafe(`
        insert into customer_accounts (internal_account_id, company_name)
        values ('acct_preserve_1', 'Acme Ltd')
      `);
    } finally {
      await sourceSql.end();
    }

    await svc.saveInternalDatabaseSetup(officelyCompanyId, {
      connectionString: sourceDb.connectionString,
      sqlQuery: "select internal_account_id, company_name from customer_accounts",
    });

    const savedSecretBefore = await secretService(db).getByName(officelyCompanyId, "OFFICELY_INTERNAL_DATABASE_URL");
    expect(savedSecretBefore).toBeTruthy();
    const savedValueBefore = await secretService(db).resolveSecretValue(officelyCompanyId, savedSecretBefore!.id, "latest");

    await expect(
      svc.saveInternalDatabaseSetup(officelyCompanyId, {
        connectionString: "postgres://127.0.0.1:1/officely",
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      }),
    ).rejects.toThrow();

    const savedSecretAfter = await secretService(db).getByName(officelyCompanyId, "OFFICELY_INTERNAL_DATABASE_URL");
    expect(savedSecretAfter?.id).toBe(savedSecretBefore?.id);
    const savedValueAfter = await secretService(db).resolveSecretValue(officelyCompanyId, savedSecretAfter!.id, "latest");
    expect(savedValueAfter).toBe(savedValueBefore);
  });

  it("preserves the last working Xero secrets when a replacement credential pair fails verification", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely Ltd",
      issuePrefix: "OFC",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockXeroFetch({
      invoices: [],
      payments: [],
    });

    await svc.saveXeroSetup(officelyCompanyId, {
      clientId: "xero-client-id",
      clientSecret: "xero-client-secret",
    });

    const savedClientIdBefore = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_ID");
    const savedClientSecretBefore = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_SECRET");
    expect(savedClientIdBefore).toBeTruthy();
    expect(savedClientSecretBefore).toBeTruthy();

    const savedClientIdValueBefore = await secretService(db).resolveSecretValue(officelyCompanyId, savedClientIdBefore!.id, "latest");
    const savedClientSecretValueBefore = await secretService(db).resolveSecretValue(officelyCompanyId, savedClientSecretBefore!.id, "latest");

    mockXeroFetch({
      tokenStatus: 401,
    });

    await expect(
      svc.saveXeroSetup(officelyCompanyId, {
        clientId: "new-client-id",
        clientSecret: "bad-client-secret",
      }),
    ).rejects.toThrow("Bad Xero credentials. Check the Xero client ID and client secret.");

    const savedClientIdAfter = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_ID");
    const savedClientSecretAfter = await secretService(db).getByName(officelyCompanyId, "OFFICELY_XERO_CLIENT_SECRET");
    expect(savedClientIdAfter?.id).toBe(savedClientIdBefore?.id);
    expect(savedClientSecretAfter?.id).toBe(savedClientSecretBefore?.id);

    const savedClientIdValueAfter = await secretService(db).resolveSecretValue(officelyCompanyId, savedClientIdAfter!.id, "latest");
    const savedClientSecretValueAfter = await secretService(db).resolveSecretValue(officelyCompanyId, savedClientSecretAfter!.id, "latest");
    expect(savedClientIdValueAfter).toBe(savedClientIdValueBefore);
    expect(savedClientSecretValueAfter).toBe(savedClientSecretValueBefore);
  });

  it("preserves the last working Stripe secret when a replacement key fails verification", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely Ltd",
      issuePrefix: "OFC",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    mockStripeFetch({
      events: [
        {
          id: "evt_keep_1",
          type: "invoice.payment_failed",
          created: 1_775_174_400,
          data: {
            object: {
              customer: "cus_keep",
              customer_name: "Acme Ltd",
              customer_email: "finance@acme.com",
              amount_due: 120000,
            },
          },
        },
      ],
    });

    await svc.saveStripeSetup(officelyCompanyId, {
      secretKey: "rk_live_working",
    });

    const savedSecretBefore = await secretService(db).getByName(officelyCompanyId, "OFFICELY_STRIPE_SECRET_KEY");
    expect(savedSecretBefore).toBeTruthy();
    const savedValueBefore = await secretService(db).resolveSecretValue(officelyCompanyId, savedSecretBefore!.id, "latest");

    mockStripeFetch({
      status: 401,
      errorMessage: "Bad Stripe credentials.",
    });

    await expect(
      svc.saveStripeSetup(officelyCompanyId, {
        secretKey: "rk_live_broken",
      }),
    ).rejects.toThrow("Bad Stripe credentials. Check the Stripe key and try again.");

    const savedSecretAfter = await secretService(db).getByName(officelyCompanyId, "OFFICELY_STRIPE_SECRET_KEY");
    expect(savedSecretAfter?.id).toBe(savedSecretBefore?.id);
    const savedValueAfter = await secretService(db).resolveSecretValue(officelyCompanyId, savedSecretAfter!.id, "latest");
    expect(savedValueAfter).toBe(savedValueBefore);
  });

  it("requires a real live connection for setup tests instead of falling back to manual snapshots", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const connectors = await svc.ensureV1Connectors(officelyCompanyId);
    const internalDatabaseConnector = connectors.find((connector) => connector.kind === "internal_database");
    expect(internalDatabaseConnector).toBeTruthy();

    await db
      .update(dataConnectors)
      .set({
        configJson: {
          provider: "internal_database",
          manualSnapshot: [
            {
              internalAccountId: "acct_snapshot_1",
              companyName: "Snapshot Co",
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, internalDatabaseConnector!.id));

    await expect(
      svc.testInternalDatabaseSetup(officelyCompanyId, {
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      }),
    ).rejects.toThrow("Add a live internal database connection before testing this setup.");
  });

  it("allows Officely sync when the workspace has been renamed but keeps the stable Officely key", async () => {
    const officelyCompanyId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely Ltd",
      issuePrefix: "OFC",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(companyProfiles).values({
      companyId: officelyCompanyId,
      workspaceKey: "officely",
      stage: "growth",
      primaryGoal: "Run Officely",
      activeCapabilities: [],
      decisionCadence: "daily",
      approvalPolicy: {},
      allowedRepos: [],
      connectedTools: [],
    });

    const result = await svc.syncV1Slice(officelyCompanyId, {
      generatedAt: "2026-04-02T00:00:00.000Z",
      internalAccounts: [],
      xeroInvoices: [],
      xeroCashReceipts: [],
      stripeEvents: [],
      posthogAccounts: [],
    });

    expect(result.profiles).toHaveLength(0);
    const connectors = await db
      .select()
      .from(dataConnectors)
      .where(eq(dataConnectors.companyId, officelyCompanyId));
    expect(connectors).toHaveLength(5);
  });
});
