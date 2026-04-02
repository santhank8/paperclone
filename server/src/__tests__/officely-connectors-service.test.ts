import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
