import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  companyProfiles,
  createSqlClient,
  customerProfiles,
  dataConnectors,
  insightCards,
} from "@paperclipai/db";
import {
  buildOfficelyCustomerProfiles,
  calculateOfficelyRevenueScorecard,
  generateOfficelyFounderBrief,
  generateOfficelyInsightDrafts,
  type OfficelyXeroCashReceiptRecord,
  type OfficelyCustomerProfileSeed,
  type OfficelyInsightDraft,
  type OfficelyInternalAccountRecord,
  type OfficelyPostHogProjectPulse,
  type OfficelySlackFeedbackPulse,
  type OfficelyStripeEventRecord,
  type OfficelyV1SyncPayload,
  type OfficelyXeroInvoiceRecord,
} from "@paperclipai/virtual-org-connectors";
import { VIRTUAL_ORG_SEED_COMPANIES } from "@paperclipai/virtual-org-core";
import { notFound, unprocessable } from "../errors.js";
import { loadOfficelyPostHogProject } from "./officely-posthog.js";
import { loadOfficelySlackConnection, loadOfficelySlackFeedback } from "./officely-slack.js";
import { loadOfficelyStripeEvents } from "./officely-stripe.js";
import { loadOfficelyXeroInvoices } from "./officely-xero.js";
import { secretService } from "./secrets.js";
import { writeOfficelyKnowledgeSnapshot } from "./company-knowledge-base.js";
import { logger } from "../middleware/logger.js";

const OFFICELY_V1_CONNECTOR_KINDS = ["internal_database", "xero", "stripe", "posthog"] as const;
const OFFICELY_BOOTSTRAP_CONNECTOR_KINDS = ["slack", ...OFFICELY_V1_CONNECTOR_KINDS] as const;
const OFFICELY_V1_INSIGHT_TYPES = [
  "officely_v1_booked_revenue",
  "officely_v1_manual_revenue",
  "officely_v1_billing_events",
  "officely_v1_revenue_pressure",
  "officely_v1_expansion_revenue",
  "officely_v1_usage_risk",
] as const;
const OFFICELY_INTERNAL_DB_MAX_ROWS = 5_000;
const OFFICELY_INTERNAL_DB_STATEMENT_TIMEOUT_MS = 10_000;
const OFFICELY_INTERNAL_DB_LOCK_TIMEOUT_MS = 2_000;
const OFFICELY_INTERNAL_DB_SECRET_NAME = "OFFICELY_INTERNAL_DATABASE_URL";
const OFFICELY_XERO_CLIENT_ID_SECRET_NAME = "OFFICELY_XERO_CLIENT_ID";
const OFFICELY_XERO_CLIENT_SECRET_SECRET_NAME = "OFFICELY_XERO_CLIENT_SECRET";
const OFFICELY_XERO_LOOKBACK_DAYS = 180;
const OFFICELY_SLACK_BOT_TOKEN_SECRET_NAME = "OFFICELY_SLACK_BOT_TOKEN";
const OFFICELY_SLACK_APP_TOKEN_SECRET_NAME = "OFFICELY_SLACK_APP_TOKEN";
const OFFICELY_STRIPE_SECRET_KEY_SECRET_NAME = "OFFICELY_STRIPE_SECRET_KEY";
const OFFICELY_STRIPE_LOOKBACK_DAYS = 30;
const OFFICELY_POSTHOG_API_KEY_SECRET_NAME = "OFFICELY_POSTHOG_API_KEY";
const OFFICELY_POSTHOG_DEFAULT_BASE_URL = "https://us.posthog.com";
const OFFICELY_POSTHOG_ACTIVITY_WINDOW_DAYS = 30;
const OFFICELY_SLACK_FEEDBACK_LOOKBACK_DAYS = 365;
const OFFICELY_DEFAULT_SLACK_INTAKE_MODE = "dm_only";
const OFFICELY_SQL_WRITE_RE =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|merge|call|vacuum|analyze|comment|refresh|reindex|cluster|discard|listen|notify)\b/i;

type OfficelyConnectorKind = (typeof OFFICELY_V1_CONNECTOR_KINDS)[number];
type DataConnectorRow = typeof dataConnectors.$inferSelect;
type JsonRecord = Record<string, unknown>;

function hasConnectorPayload(kind: OfficelyConnectorKind, payload: OfficelyV1SyncPayload) {
  if (kind === "internal_database") return payload.internalAccounts.length > 0;
  if (kind === "xero") return payload.xeroInvoices.length > 0 || payload.xeroCashReceipts.length > 0;
  if (kind === "stripe") return payload.stripeEvents.length > 0;
  return payload.posthogAccounts.length > 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => entry !== null);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return undefined;
}

function asDateInput(value: unknown): string | Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return asString(value);
}

function asConnectorConfig(row: DataConnectorRow): JsonRecord {
  return isRecord(row.configJson) ? row.configJson : {};
}

function asConnectorConfigArray<T>(row: DataConnectorRow | null | undefined, key: string): T[] {
  if (!row) return [];
  const value = asConnectorConfig(row)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function mergeConnectorConfig(row: DataConnectorRow, patch: JsonRecord): JsonRecord {
  return {
    ...asConnectorConfig(row),
    ...patch,
  };
}

function isConnectorEnabled(config: JsonRecord) {
  return asBoolean(config.enabled) ?? true;
}

function slackIntakeMode(config: JsonRecord) {
  return asString(config.intakeMode) === "dm_and_channel" ? "dm_and_channel" : OFFICELY_DEFAULT_SLACK_INTAKE_MODE;
}

function summarizeSlackConnector(config: {
  enabled: boolean;
  teamName?: string | null;
  intakeMode: string;
  defaultChannelId?: string | null;
}) {
  if (!config.enabled) {
    return "Disabled. Slack intake is paused for this company.";
  }

  const scope = config.intakeMode === "dm_and_channel" ? "DMs and a default channel" : "founder DMs";
  const team = config.teamName?.trim() ? `Connected to ${config.teamName}. ` : "";
  const channel = config.defaultChannelId?.trim()
    ? `Default channel ${config.defaultChannelId.trim()}.`
    : "No default channel set.";
  return `${team}Listens for ${scope}. ${channel}`.trim();
}

function summarizePostHogConnector(config: {
  enabled: boolean;
  projectId?: string | null;
  eventCount?: number;
  activeUserTotal?: number;
}) {
  if (!config.enabled) {
    return "Disabled. Product usage sync is paused for this company.";
  }

  const project = config.projectId?.trim() ? `Project ${config.projectId.trim()}` : "Configured PostHog project";
  const activity = typeof config.activeUserTotal === "number"
    ? `${config.activeUserTotal} active user${config.activeUserTotal === 1 ? "" : "s"}`
    : "active usage preview pending";
  const volume = typeof config.eventCount === "number"
    ? ` and ${config.eventCount} event${config.eventCount === 1 ? "" : "s"} in the last 30 days.`
    : ".";
  return `${project}. Last preview found ${activity}${volume}`.trim();
}

function summarizeStripeEvents(events: OfficelyStripeEventRecord[]) {
  return {
    eventCount: events.length,
    failedPaymentCount: events.filter((event) => event.eventType === "payment_failed").length,
    refundCount: events.filter((event) => event.eventType === "refund").length,
    cancellationCount: events.filter((event) => event.eventType === "cancellation").length,
    upgradeCount: events.filter((event) => event.eventType === "upgrade").length,
    downgradeCount: events.filter((event) => event.eventType === "downgrade").length,
    sampleCompanies: [...new Set(
      events
        .map((event) => event.companyName?.trim() || event.customerId)
        .filter((value): value is string => Boolean(value)),
    )].slice(0, 3),
  };
}

function summarizeStripeCashReceipts(receipts: OfficelyXeroCashReceiptRecord[]) {
  return receipts
    .filter((receipt) => receipt.source === "stripe")
    .sort((left, right) => {
      const leftTime = new Date(left.receivedAt).getTime();
      const rightTime = new Date(right.receivedAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 5)
    .map((receipt) => ({
      receivedAt: typeof receipt.receivedAt === "string" ? receipt.receivedAt : receipt.receivedAt.toISOString(),
      amount: receipt.amount,
      currency: receipt.currency,
      bankAccountName: receipt.bankAccountName ?? null,
      reference: receipt.reference ?? null,
      companyName: receipt.companyName ?? null,
    }));
}

function buildProfileSeed(row: typeof customerProfiles.$inferSelect): OfficelyCustomerProfileSeed {
  return {
    id: row.id,
    companyName: row.companyName,
    accountName: row.accountName,
    workspaceId: row.workspaceId,
    primaryEmailDomain: row.primaryEmailDomain,
    planName: row.planName,
    accountStatus: row.accountStatus,
    firstSeenAt: row.firstSeenAt,
    ownerUserId: row.ownerUserId,
    hubspotCompanyId: row.hubspotCompanyId,
    hubspotDealIds: row.hubspotDealIds,
    stripeCustomerId: row.stripeCustomerId,
    xeroContactId: row.xeroContactId,
    intercomCompanyId: row.intercomCompanyId,
    posthogGroupKey: row.posthogGroupKey,
    internalAccountId: row.internalAccountId,
    attributesJson: (row.attributesJson ?? {}) as Record<string, unknown>,
  };
}

function connectorIdsByKind(rows: Array<typeof dataConnectors.$inferSelect>) {
  return new Map(rows.map((row) => [row.kind, row.id]));
}

function toInsightInsert(
  companyId: string,
  connectorIdMap: Map<string, string>,
  draft: OfficelyInsightDraft,
): typeof insightCards.$inferInsert {
  return {
    companyId,
    type: draft.type,
    title: draft.title,
    summary: draft.summary,
    confidence: draft.confidence,
    sourceConnectorIds: draft.sourceKinds
      .map((kind) => connectorIdMap.get(kind))
      .filter((value): value is string => Boolean(value)),
    recommendedAction: draft.recommendedAction,
    status: "active",
  };
}

function validateReadOnlySelectQuery(rawQuery: unknown): string {
  const query = asString(rawQuery);
  if (!query) {
    throw unprocessable("Internal database sync needs a read-only SQL query.");
  }
  if (!/^select\b/i.test(query)) {
    throw unprocessable("Internal database query must start with SELECT.");
  }
  if (query.includes(";")) {
    throw unprocessable("Internal database query must be a single SELECT without semicolons.");
  }
  if (OFFICELY_SQL_WRITE_RE.test(query)) {
    throw unprocessable("Internal database query can only read data, not change it.");
  }
  return query;
}

function mapInternalAccountRow(row: JsonRecord, index: number): OfficelyInternalAccountRecord {
  const internalAccountId = asString(row.internal_account_id);
  if (!internalAccountId) {
    throw unprocessable(`Internal database row ${index + 1} is missing internal_account_id.`);
  }

  const companyName = asString(row.company_name);
  if (!companyName) {
    throw unprocessable(`Internal database row ${index + 1} is missing company_name.`);
  }

  return {
    internalAccountId,
    companyName,
    accountName: asString(row.account_name),
    workspaceId: asString(row.workspace_id),
    primaryEmailDomain: asString(row.primary_email_domain),
    planName: asString(row.plan_name),
    accountStatus: asString(row.account_status),
    firstSeenAt: asDateInput(row.first_seen_at),
    ownerUserId: asString(row.owner_user_id),
    hubspotCompanyId: asString(row.hubspot_company_id),
    hubspotDealIds: asStringArray(row.hubspot_deal_ids),
    stripeCustomerId: asString(row.stripe_customer_id),
    xeroContactId: asString(row.xero_contact_id),
    intercomCompanyId: asString(row.intercom_company_id),
    posthogGroupKey: asString(row.posthog_group_key),
    userCount: asNumber(row.user_count),
    mrr: asNumber(row.mrr),
    churnRisk: asString(row.churn_risk),
    onboardingState: asString(row.onboarding_state),
  };
}

export function officelyConnectorService(db: Db) {
  const secrets = secretService(db);
  const officelySeed = VIRTUAL_ORG_SEED_COMPANIES.find((seed) => seed.key === "officely") ?? null;

  async function assertCompany(companyId: string) {
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!company) throw notFound("Company not found");
    return company;
  }

  async function assertOfficelyCompany(companyId: string) {
    await assertCompany(companyId);
    if (!officelySeed) throw notFound("Officely seed not found");

    const profile = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, companyId))
      .then((rows) => rows[0] ?? null);

    if (profile?.workspaceKey !== officelySeed.key) {
      throw unprocessable("Officely sync is only available for the Officely workspace.");
    }
  }

  async function ensureV1Connectors(companyId: string) {
    await assertOfficelyCompany(companyId);
    if (!officelySeed) return [];

    const desiredConnectors = officelySeed.connectors.filter((connector) =>
      OFFICELY_BOOTSTRAP_CONNECTOR_KINDS.includes(connector.kind as (typeof OFFICELY_BOOTSTRAP_CONNECTOR_KINDS)[number]));
    const existing = await db
      .select()
      .from(dataConnectors)
      .where(and(eq(dataConnectors.companyId, companyId), inArray(dataConnectors.kind, [...OFFICELY_BOOTSTRAP_CONNECTOR_KINDS])));
    const existingByKind = new Map(existing.map((row) => [row.kind, row]));

    for (const connector of desiredConnectors) {
      const existingRow = existingByKind.get(connector.kind);
      if (!existingRow) {
        await db.insert(dataConnectors).values({
          companyId,
          kind: connector.kind,
          status: connector.status ?? "planned",
          displayName: connector.displayName,
          configSummary: connector.configSummary,
          configJson: connector.configJson ?? {},
          policyJson: connector.policyJson ?? {},
        });
        continue;
      }

      await db
        .update(dataConnectors)
        .set({
          displayName: connector.displayName,
          configSummary: connector.configSummary,
          configJson: {
            ...(connector.configJson ?? {}),
            ...asConnectorConfig(existingRow),
          },
          policyJson: {
            ...(isRecord(connector.policyJson) ? connector.policyJson : {}),
            ...(isRecord(existingRow.policyJson) ? existingRow.policyJson : {}),
          },
          updatedAt: new Date(),
        })
        .where(eq(dataConnectors.id, existingRow.id));
    }

    return db
      .select()
      .from(dataConnectors)
      .where(and(eq(dataConnectors.companyId, companyId), inArray(dataConnectors.kind, [...OFFICELY_BOOTSTRAP_CONNECTOR_KINDS])));
  }

  async function getInternalDatabaseConnector(companyId: string) {
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "internal_database") ?? null;
    if (!connector) {
      throw notFound("Officely internal database connector not found");
    }
    return connector;
  }

  async function upsertNamedSecret(
    companyId: string,
    secretName: string,
    value: string,
    description: string,
  ) {
    const existing = await secrets.getByName(companyId, secretName);
    if (!existing) {
      return secrets.create(companyId, {
        name: secretName,
        provider: "local_encrypted",
        value,
        description,
      });
    }

    await secrets.rotate(existing.id, { value });
    return secrets.getById(existing.id).then((secret) => {
      if (!secret) throw notFound("Secret not found after rotation");
      return secret;
    });
  }

  async function upsertInternalDatabaseSecret(companyId: string, connectionString: string) {
    return upsertNamedSecret(
      companyId,
      OFFICELY_INTERNAL_DB_SECRET_NAME,
      connectionString,
      "Read-only connection string for Officely customer identity sync.",
    );
  }

  async function loadInternalDatabaseAccountsFromConfig(
    companyId: string,
    config: JsonRecord,
    fallbackConnector?: DataConnectorRow,
    opts?: { allowManualSnapshotFallback?: boolean },
  ) {
    const connectionSecretId = asString(config.connectionSecretId);
    const sqlQuery = asString(config.sqlQuery);
    const directConnectionString = asString(config.connectionString);

    if (!directConnectionString && (!connectionSecretId || !sqlQuery)) {
      if (opts?.allowManualSnapshotFallback === false) {
        throw unprocessable("Add a live internal database connection before testing this setup.");
      }
      return fallbackConnector ? asConnectorConfigArray<OfficelyInternalAccountRecord>(fallbackConnector, "manualSnapshot") : [];
    }

    const connectionString = directConnectionString ?? await secrets.resolveSecretValue(
      companyId,
      connectionSecretId!,
      typeof config.connectionSecretVersion === "number" && Number.isInteger(config.connectionSecretVersion)
        ? config.connectionSecretVersion
        : "latest",
    );
    const query = validateReadOnlySelectQuery(sqlQuery);
    const sql = createSqlClient(connectionString, { max: 1, onnotice: () => {}, connect_timeout: 5 });

    try {
      const rows = await sql.begin(async (tx) => {
        await tx.unsafe("set transaction read only");
        await tx.unsafe(`set local statement_timeout = ${OFFICELY_INTERNAL_DB_STATEMENT_TIMEOUT_MS}`);
        await tx.unsafe(`set local lock_timeout = ${OFFICELY_INTERNAL_DB_LOCK_TIMEOUT_MS}`);
        return tx.unsafe<JsonRecord[]>(query);
      });

      if (rows.length > OFFICELY_INTERNAL_DB_MAX_ROWS) {
        throw unprocessable(
          `Internal database query returned ${rows.length} rows. Keep the first slice under ${OFFICELY_INTERNAL_DB_MAX_ROWS} accounts.`,
        );
      }

      return rows.map((row, index) => mapInternalAccountRow(row, index));
    } finally {
      await sql.end();
    }
  }

  async function loadInternalDatabaseAccounts(companyId: string, connector: DataConnectorRow) {
    return loadInternalDatabaseAccountsFromConfig(companyId, asConnectorConfig(connector), connector);
  }

  async function previewLiveInternalDatabaseSetup(
    companyId: string,
    connector: DataConnectorRow,
    input: { connectionString?: string | null; sqlQuery: string },
  ) {
    const sqlQuery = validateReadOnlySelectQuery(input.sqlQuery);
    const directConnectionString = input.connectionString?.trim() || null;
    const config: JsonRecord = directConnectionString
      ? {
          ...asConnectorConfig(connector),
          connectionString: directConnectionString,
          sqlQuery,
        }
      : {
          ...asConnectorConfig(connector),
          sqlQuery,
        };

    const accounts = await loadInternalDatabaseAccountsFromConfig(
      companyId,
      config,
      connector,
      { allowManualSnapshotFallback: false },
    );

    return {
      sqlQuery,
      usedSavedConnection: !directConnectionString,
      accountCount: accounts.length,
      sampleCompanies: accounts
        .map((account) => account.companyName)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 3),
    };
  }

  async function saveInternalDatabaseSetup(
    companyId: string,
    input: { connectionString?: string | null; sqlQuery: string },
  ) {
    await assertOfficelyCompany(companyId);
    const connector = await getInternalDatabaseConnector(companyId);
    const preview = await previewLiveInternalDatabaseSetup(companyId, connector, input);
    const existingConfig = asConnectorConfig(connector);
    let connectionSecretId = asString(existingConfig.connectionSecretId);

    if (input.connectionString && input.connectionString.trim().length > 0) {
      const secret = await upsertInternalDatabaseSecret(companyId, input.connectionString.trim());
      connectionSecretId = secret.id;
    }

    if (!connectionSecretId) {
      throw unprocessable("Add the internal database connection string before saving this setup.");
    }

    const configJson = mergeConnectorConfig(connector, {
      provider: "internal_database",
      syncMode: "read_only_sql_query",
      recommended: true,
      sourceOfTruthFor: ["customer_identity"],
      connectionSecretId,
      sqlQuery: preview.sqlQuery,
    });

    await db
      .update(dataConnectors)
      .set({
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, connector.id));

    return {
      companyId,
      connectorId: connector.id,
      secretName: OFFICELY_INTERNAL_DB_SECRET_NAME,
      hasSavedConnection: true,
      queryConfigured: true,
      accountCount: preview.accountCount,
      sampleCompanies: preview.sampleCompanies,
      usedSavedConnection: preview.usedSavedConnection,
    };
  }

  async function testInternalDatabaseSetup(
    companyId: string,
    input: { connectionString?: string | null; sqlQuery: string },
  ) {
    await assertOfficelyCompany(companyId);
    const connector = await getInternalDatabaseConnector(companyId);
    const preview = await previewLiveInternalDatabaseSetup(companyId, connector, input);

    return {
      companyId,
      accountCount: preview.accountCount,
      sampleCompanies: preview.sampleCompanies,
      usedSavedConnection: preview.usedSavedConnection,
    };
  }

  async function loadXeroInvoicesFromConfig(
    companyId: string,
    config: JsonRecord,
    fallbackConnector?: DataConnectorRow,
    opts?: { allowManualSnapshotFallback?: boolean },
  ) {
    const clientIdSecretId = asString(config.clientIdSecretId);
    const clientSecretSecretId = asString(config.clientSecretSecretId);
    const directClientId = asString(config.clientId);
    const directClientSecret = asString(config.clientSecret);

    if ((!directClientId && !clientIdSecretId) || (!directClientSecret && !clientSecretSecretId)) {
      if (opts?.allowManualSnapshotFallback === false) {
        throw unprocessable("Add the Xero custom connection credentials before testing this setup.");
      }
      return {
        invoices: fallbackConnector ? asConnectorConfigArray<OfficelyXeroInvoiceRecord>(fallbackConnector, "manualSnapshot") : [],
        cashReceipts: [],
      };
    }

    const clientId = directClientId ?? await secrets.resolveSecretValue(
      companyId,
      clientIdSecretId!,
      typeof config.clientIdSecretVersion === "number" && Number.isInteger(config.clientIdSecretVersion)
        ? config.clientIdSecretVersion
        : "latest",
    );
    const clientSecret = directClientSecret ?? await secrets.resolveSecretValue(
      companyId,
      clientSecretSecretId!,
      typeof config.clientSecretSecretVersion === "number" && Number.isInteger(config.clientSecretSecretVersion)
        ? config.clientSecretSecretVersion
        : "latest",
    );
    const preview = await loadOfficelyXeroInvoices({
      clientId,
      clientSecret,
      lookbackDays:
        typeof config.invoiceLookbackDays === "number" && Number.isFinite(config.invoiceLookbackDays)
          ? Number(config.invoiceLookbackDays)
          : OFFICELY_XERO_LOOKBACK_DAYS,
    });

    return preview;
  }

  async function loadXeroInvoices(companyId: string, connector: DataConnectorRow) {
    return loadXeroInvoicesFromConfig(companyId, asConnectorConfig(connector), connector);
  }

  async function loadStripeEventsFromConfig(
    companyId: string,
    config: JsonRecord,
    fallbackConnector?: DataConnectorRow,
    opts?: { allowManualSnapshotFallback?: boolean },
  ) {
    const secretKeySecretId = asString(config.secretKeySecretId);
    const directSecretKey = asString(config.secretKey);

    if (!directSecretKey && !secretKeySecretId) {
      if (opts?.allowManualSnapshotFallback === false) {
        throw unprocessable("Add the Stripe secret key before testing this setup.");
      }
      return fallbackConnector ? asConnectorConfigArray<OfficelyStripeEventRecord>(fallbackConnector, "manualSnapshot") : [];
    }

    const secretKey = directSecretKey ?? await secrets.resolveSecretValue(
      companyId,
      secretKeySecretId!,
      typeof config.secretKeySecretVersion === "number" && Number.isInteger(config.secretKeySecretVersion)
        ? config.secretKeySecretVersion
        : "latest",
    );
    const preview = await loadOfficelyStripeEvents({
      secretKey,
      lookbackDays:
        typeof config.eventLookbackDays === "number" && Number.isFinite(config.eventLookbackDays)
          ? Number(config.eventLookbackDays)
          : OFFICELY_STRIPE_LOOKBACK_DAYS,
    });

    return preview.events;
  }

  async function loadStripeEvents(companyId: string, connector: DataConnectorRow) {
    return loadStripeEventsFromConfig(companyId, asConnectorConfig(connector), connector);
  }

  async function previewLiveXeroSetup(
    companyId: string,
    connector: DataConnectorRow,
    input: { clientId?: string | null; clientSecret?: string | null },
  ) {
    const directClientId = input.clientId?.trim() || null;
    const directClientSecret = input.clientSecret?.trim() || null;
    const config: JsonRecord = directClientId || directClientSecret
      ? {
          ...asConnectorConfig(connector),
          clientId: directClientId,
          clientSecret: directClientSecret,
        }
      : asConnectorConfig(connector);
    const preview = await loadXeroInvoicesFromConfig(
      companyId,
      config,
      connector,
      { allowManualSnapshotFallback: false },
    );

    return {
      invoices: preview.invoices,
      cashReceipts: preview.cashReceipts,
      usedSavedClientId: !directClientId,
      usedSavedClientSecret: !directClientSecret,
      sampleCompanies: [...new Set(
        [...preview.invoices, ...preview.cashReceipts].map((record) => record.companyName?.trim()).filter((value): value is string => Boolean(value)),
      )].slice(0, 3),
      cashReceiptCount: preview.cashReceipts.length,
      stripeCashReceiptCount: preview.cashReceipts.filter((receipt) => receipt.source === "stripe").length,
      manualPaymentCount: preview.invoices.filter((invoice) => invoice.manualPayment === true).length,
      latestStripeCashReceipts: summarizeStripeCashReceipts(preview.cashReceipts),
    };
  }

  async function saveXeroSetup(
    companyId: string,
    input: { clientId?: string | null; clientSecret?: string | null },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "xero") ?? null;
    if (!connector) {
      throw notFound("Officely Xero connector not found");
    }

    const preview = await previewLiveXeroSetup(companyId, connector, input);
    const existingConfig = asConnectorConfig(connector);
    let clientIdSecretId = asString(existingConfig.clientIdSecretId);
    let clientSecretSecretId = asString(existingConfig.clientSecretSecretId);

    if (input.clientId && input.clientId.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_XERO_CLIENT_ID_SECRET_NAME,
        input.clientId.trim(),
        "Xero custom connection client ID for Officely revenue sync.",
      );
      clientIdSecretId = secret.id;
    }

    if (input.clientSecret && input.clientSecret.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_XERO_CLIENT_SECRET_SECRET_NAME,
        input.clientSecret.trim(),
        "Xero custom connection client secret for Officely revenue sync.",
      );
      clientSecretSecretId = secret.id;
    }

    if (!clientIdSecretId || !clientSecretSecretId) {
      throw unprocessable("Add both the Xero client ID and client secret before saving this setup.");
    }

    const configJson = mergeConnectorConfig(connector, {
      provider: "xero_custom_connection",
      syncMode: "client_credentials",
      recommended: true,
      sourceOfTruthFor: ["booked_revenue", "manual_transfers"],
      invoiceLookbackDays: OFFICELY_XERO_LOOKBACK_DAYS,
      clientIdSecretId,
      clientSecretSecretId,
    });

    await db
      .update(dataConnectors)
      .set({
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, connector.id));

    return {
      companyId,
      connectorId: connector.id,
      hasSavedClientId: true,
      hasSavedClientSecret: true,
      invoiceCount: preview.invoices.length,
      cashReceiptCount: preview.cashReceiptCount,
      stripeCashReceiptCount: preview.stripeCashReceiptCount,
      manualPaymentCount: preview.manualPaymentCount,
      sampleCompanies: preview.sampleCompanies,
      latestStripeCashReceipts: preview.latestStripeCashReceipts,
      usedSavedClientId: preview.usedSavedClientId,
      usedSavedClientSecret: preview.usedSavedClientSecret,
    };
  }

  async function testXeroSetup(
    companyId: string,
    input: { clientId?: string | null; clientSecret?: string | null },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "xero") ?? null;
    if (!connector) {
      throw notFound("Officely Xero connector not found");
    }

    const preview = await previewLiveXeroSetup(companyId, connector, input);

    return {
      companyId,
      invoiceCount: preview.invoices.length,
      cashReceiptCount: preview.cashReceiptCount,
      stripeCashReceiptCount: preview.stripeCashReceiptCount,
      manualPaymentCount: preview.manualPaymentCount,
      sampleCompanies: preview.sampleCompanies,
      latestStripeCashReceipts: preview.latestStripeCashReceipts,
      usedSavedClientId: preview.usedSavedClientId,
      usedSavedClientSecret: preview.usedSavedClientSecret,
    };
  }

  async function previewLiveStripeSetup(
    companyId: string,
    connector: DataConnectorRow,
    input: { secretKey?: string | null },
  ) {
    const directSecretKey = input.secretKey?.trim() || null;
    const config: JsonRecord = directSecretKey
      ? {
          ...asConnectorConfig(connector),
          secretKey: directSecretKey,
        }
      : asConnectorConfig(connector);
    const events = await loadStripeEventsFromConfig(
      companyId,
      config,
      connector,
      { allowManualSnapshotFallback: false },
    );
    const summary = summarizeStripeEvents(events);

    return {
      events,
      ...summary,
      usedSavedSecretKey: !directSecretKey,
    };
  }

  async function saveStripeSetup(
    companyId: string,
    input: { secretKey?: string | null },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "stripe") ?? null;
    if (!connector) {
      throw notFound("Officely Stripe connector not found");
    }

    const preview = await previewLiveStripeSetup(companyId, connector, input);
    const existingConfig = asConnectorConfig(connector);
    let secretKeySecretId = asString(existingConfig.secretKeySecretId);

    if (input.secretKey && input.secretKey.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_STRIPE_SECRET_KEY_SECRET_NAME,
        input.secretKey.trim(),
        "Stripe secret key for Officely automated billing-event sync.",
      );
      secretKeySecretId = secret.id;
    }

    if (!secretKeySecretId) {
      throw unprocessable("Add the Stripe secret key before saving this setup.");
    }

    const configJson = mergeConnectorConfig(connector, {
      provider: "stripe_events_api",
      syncMode: "rest_api",
      recommended: true,
      sourceOfTruthFor: ["payment_events"],
      eventLookbackDays: OFFICELY_STRIPE_LOOKBACK_DAYS,
      secretKeySecretId,
    });

    await db
      .update(dataConnectors)
      .set({
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, connector.id));

    return {
      companyId,
      connectorId: connector.id,
      hasSavedSecretKey: true,
      eventCount: preview.eventCount,
      failedPaymentCount: preview.failedPaymentCount,
      refundCount: preview.refundCount,
      cancellationCount: preview.cancellationCount,
      upgradeCount: preview.upgradeCount,
      downgradeCount: preview.downgradeCount,
      sampleCompanies: preview.sampleCompanies,
      usedSavedSecretKey: preview.usedSavedSecretKey,
    };
  }

  async function testStripeSetup(
    companyId: string,
    input: { secretKey?: string | null },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "stripe") ?? null;
    if (!connector) {
      throw notFound("Officely Stripe connector not found");
    }

    const preview = await previewLiveStripeSetup(companyId, connector, input);

    return {
      companyId,
      eventCount: preview.eventCount,
      failedPaymentCount: preview.failedPaymentCount,
      refundCount: preview.refundCount,
      cancellationCount: preview.cancellationCount,
      upgradeCount: preview.upgradeCount,
      downgradeCount: preview.downgradeCount,
      sampleCompanies: preview.sampleCompanies,
      usedSavedSecretKey: preview.usedSavedSecretKey,
    };
  }

  async function loadSlackConnectionFromConfig(
    companyId: string,
    config: JsonRecord,
  ) {
    const botTokenSecretId = asString(config.botTokenSecretId);
    const appTokenSecretId = asString(config.appTokenSecretId);
    const directBotToken = asString(config.botToken);
    const directAppToken = asString(config.appToken);

    if ((!directBotToken && !botTokenSecretId) || (!directAppToken && !appTokenSecretId)) {
      throw unprocessable("Add both the Slack bot token and app token before testing this setup.");
    }

    const botToken = directBotToken ?? await secrets.resolveSecretValue(
      companyId,
      botTokenSecretId!,
      typeof config.botTokenSecretVersion === "number" && Number.isInteger(config.botTokenSecretVersion)
        ? config.botTokenSecretVersion
        : "latest",
    );
    const appToken = directAppToken ?? await secrets.resolveSecretValue(
      companyId,
      appTokenSecretId!,
      typeof config.appTokenSecretVersion === "number" && Number.isInteger(config.appTokenSecretVersion)
        ? config.appTokenSecretVersion
        : "latest",
    );

    return loadOfficelySlackConnection({ botToken, appToken });
  }

  async function loadSlackFeedbackFromConfig(
    companyId: string,
    config: JsonRecord,
  ) {
    if (!isConnectorEnabled(config)) return null;

    const defaultChannelId = asString(config.defaultChannelId);
    if (!defaultChannelId) return null;

    const botTokenSecretId = asString(config.botTokenSecretId);
    const directBotToken = asString(config.botToken);
    if (!directBotToken && !botTokenSecretId) return null;

    const botToken = directBotToken ?? await secrets.resolveSecretValue(
      companyId,
      botTokenSecretId!,
      typeof config.botTokenSecretVersion === "number" && Number.isInteger(config.botTokenSecretVersion)
        ? config.botTokenSecretVersion
        : "latest",
    );

    return loadOfficelySlackFeedback({
      botToken,
      channelId: defaultChannelId,
      lookbackDays:
        typeof config.feedbackLookbackDays === "number" && Number.isFinite(config.feedbackLookbackDays)
          ? Number(config.feedbackLookbackDays)
          : OFFICELY_SLACK_FEEDBACK_LOOKBACK_DAYS,
    });
  }

  async function previewLiveSlackSetup(
    companyId: string,
    connector: DataConnectorRow,
    input: {
      enabled: boolean;
      botToken?: string | null;
      appToken?: string | null;
      defaultChannelId?: string | null;
      founderUserId?: string | null;
      intakeMode?: "dm_only" | "dm_and_channel";
    },
  ) {
    const existingConfig = asConnectorConfig(connector);
    const directBotToken = input.botToken?.trim() || null;
    const directAppToken = input.appToken?.trim() || null;
    const intakeMode = input.intakeMode ?? slackIntakeMode(existingConfig);
    const defaultChannelId = input.defaultChannelId?.trim() || asString(existingConfig.defaultChannelId);
    const founderUserId = input.founderUserId?.trim() || asString(existingConfig.founderUserId);

    if (!input.enabled) {
      return {
        enabled: false,
        teamId: asString(existingConfig.teamId),
        teamName: asString(existingConfig.teamName),
        botUserId: asString(existingConfig.botUserId),
        botUserName: asString(existingConfig.botUserName),
        appId: asString(existingConfig.appId),
        defaultChannelId,
        founderUserId,
        intakeMode,
        usedSavedBotToken: !directBotToken,
        usedSavedAppToken: !directAppToken,
        checkedAt: new Date().toISOString(),
      };
    }

    const config: JsonRecord = {
      ...existingConfig,
      enabled: true,
      intakeMode,
      defaultChannelId,
      founderUserId,
    };
    if (directBotToken) config.botToken = directBotToken;
    if (directAppToken) config.appToken = directAppToken;

    const preview = await loadSlackConnectionFromConfig(companyId, config);

    return {
      enabled: true,
      ...preview,
      defaultChannelId,
      founderUserId,
      intakeMode,
      usedSavedBotToken: !directBotToken,
      usedSavedAppToken: !directAppToken,
    };
  }

  async function saveSlackSetup(
    companyId: string,
    input: {
      enabled: boolean;
      botToken?: string | null;
      appToken?: string | null;
      defaultChannelId?: string | null;
      founderUserId?: string | null;
      intakeMode?: "dm_only" | "dm_and_channel";
    },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "slack") ?? null;
    if (!connector) {
      throw notFound("Officely Slack connector not found");
    }

    const preview = await previewLiveSlackSetup(companyId, connector, input);
    const existingConfig = asConnectorConfig(connector);
    let botTokenSecretId = asString(existingConfig.botTokenSecretId);
    let appTokenSecretId = asString(existingConfig.appTokenSecretId);

    if (input.enabled && input.botToken && input.botToken.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_SLACK_BOT_TOKEN_SECRET_NAME,
        input.botToken.trim(),
        "Slack bot token for company-scoped founder intake.",
      );
      botTokenSecretId = secret.id;
    }

    if (input.enabled && input.appToken && input.appToken.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_SLACK_APP_TOKEN_SECRET_NAME,
        input.appToken.trim(),
        "Slack app token for company-scoped Socket Mode intake.",
      );
      appTokenSecretId = secret.id;
    }

    if (input.enabled && (!botTokenSecretId || !appTokenSecretId)) {
      throw unprocessable("Add both the Slack bot token and app token before saving this setup.");
    }

    const configJson = mergeConnectorConfig(connector, {
      provider: "slack_socket_mode",
      role: "founder_intake",
      enabled: input.enabled,
      botTokenSecretId,
      appTokenSecretId,
      teamId: preview.teamId,
      teamName: preview.teamName,
      botUserId: preview.botUserId,
      botUserName: preview.botUserName,
      appId: preview.appId,
      defaultChannelId: preview.defaultChannelId,
      founderUserId: preview.founderUserId,
      intakeMode: preview.intakeMode,
      feedbackLookbackDays: OFFICELY_SLACK_FEEDBACK_LOOKBACK_DAYS,
      lastCheckedAt: preview.checkedAt,
      lastHealthyAt: input.enabled ? preview.checkedAt : asString(existingConfig.lastHealthyAt),
    });

    await db
      .update(dataConnectors)
      .set({
        status: input.enabled ? "connected" : "planned",
        configSummary: summarizeSlackConnector(preview),
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, connector.id));

    return {
      companyId,
      connectorId: connector.id,
      enabled: input.enabled,
      hasSavedBotToken: Boolean(botTokenSecretId),
      hasSavedAppToken: Boolean(appTokenSecretId),
      teamId: preview.teamId,
      teamName: preview.teamName,
      botUserId: preview.botUserId,
      botUserName: preview.botUserName,
      appId: preview.appId,
      defaultChannelId: preview.defaultChannelId,
      founderUserId: preview.founderUserId,
      intakeMode: preview.intakeMode,
      usedSavedBotToken: preview.usedSavedBotToken,
      usedSavedAppToken: preview.usedSavedAppToken,
      checkedAt: preview.checkedAt,
    };
  }

  async function testSlackSetup(
    companyId: string,
    input: {
      enabled: boolean;
      botToken?: string | null;
      appToken?: string | null;
      defaultChannelId?: string | null;
      founderUserId?: string | null;
      intakeMode?: "dm_only" | "dm_and_channel";
    },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "slack") ?? null;
    if (!connector) {
      throw notFound("Officely Slack connector not found");
    }

    const preview = await previewLiveSlackSetup(companyId, connector, input);

    return {
      companyId,
      enabled: input.enabled,
      teamId: preview.teamId,
      teamName: preview.teamName,
      botUserId: preview.botUserId,
      botUserName: preview.botUserName,
      appId: preview.appId,
      defaultChannelId: preview.defaultChannelId,
      founderUserId: preview.founderUserId,
      intakeMode: preview.intakeMode,
      usedSavedBotToken: preview.usedSavedBotToken,
      usedSavedAppToken: preview.usedSavedAppToken,
      checkedAt: preview.checkedAt,
    };
  }

  async function loadPostHogProjectFromConfig(
    companyId: string,
    config: JsonRecord,
    opts?: { allowManualSnapshotFallback?: boolean },
  ) {
    const onboardingEvent = asString(config.onboardingEvent);
    const importantEvents = asStringArray(config.importantEvents) ?? [];

    if (!isConnectorEnabled(config)) {
      return {
        eventCount: 0,
        activeUserTotal: 0,
        onboardingEvent,
        onboardingEventCount: 0,
        importantEvents,
        importantEventCounts: importantEvents.map((eventName) => ({ eventName, count: 0 })),
        checkedAt: new Date().toISOString(),
      };
    }

    const apiKeySecretId = asString(config.apiKeySecretId);
    const directApiKey = asString(config.apiKey);
    const projectId = asString(config.projectId);
    const baseUrl = asString(config.baseUrl) ?? OFFICELY_POSTHOG_DEFAULT_BASE_URL;

    if ((!directApiKey && !apiKeySecretId) || !projectId) {
      if (opts?.allowManualSnapshotFallback === false) {
        throw unprocessable("Add the PostHog API key and project ID before testing this setup.");
      }
      return {
        eventCount: 0,
        activeUserTotal: 0,
        onboardingEvent,
        onboardingEventCount: 0,
        importantEvents,
        importantEventCounts: importantEvents.map((eventName) => ({ eventName, count: 0 })),
        checkedAt: new Date().toISOString(),
      };
    }

    const apiKey = directApiKey ?? await secrets.resolveSecretValue(
      companyId,
      apiKeySecretId!,
      typeof config.apiKeySecretVersion === "number" && Number.isInteger(config.apiKeySecretVersion)
        ? config.apiKeySecretVersion
        : "latest",
    );
    return loadOfficelyPostHogProject({
      apiKey,
      projectId,
      baseUrl,
      onboardingEvent,
      importantEvents,
      activityWindowDays:
        typeof config.activityWindowDays === "number" && Number.isFinite(config.activityWindowDays)
          ? Number(config.activityWindowDays)
          : OFFICELY_POSTHOG_ACTIVITY_WINDOW_DAYS,
    });
  }

  async function previewLivePostHogSetup(
    companyId: string,
    connector: DataConnectorRow,
    input: {
      enabled: boolean;
      apiKey?: string | null;
      projectId?: string | null;
      baseUrl?: string | null;
      onboardingEvent?: string | null;
      importantEvents?: string[];
    },
  ) {
    const existingConfig = asConnectorConfig(connector);
    const directApiKey = input.apiKey?.trim() || null;
    const projectId = input.projectId?.trim() || asString(existingConfig.projectId);
    const baseUrl = input.baseUrl?.trim() || asString(existingConfig.baseUrl) || OFFICELY_POSTHOG_DEFAULT_BASE_URL;
    const onboardingEvent = input.onboardingEvent?.trim() || asString(existingConfig.onboardingEvent);
    const importantEvents = (input.importantEvents && input.importantEvents.length > 0)
      ? input.importantEvents
      : (asStringArray(existingConfig.importantEvents) ?? []);

    if (!input.enabled) {
      return {
        enabled: false,
        projectId,
        baseUrl,
        eventCount: 0,
        activeUserTotal: 0,
        onboardingEvent,
        onboardingEventCount: 0,
        importantEvents,
        importantEventCounts: importantEvents.map((eventName) => ({ eventName, count: 0 })),
        checkedAt: new Date().toISOString(),
        usedSavedApiKey: !directApiKey,
      };
    }

    const config: JsonRecord = {
      ...existingConfig,
      enabled: true,
      projectId,
      baseUrl,
      onboardingEvent,
      importantEvents,
    };
    if (directApiKey) config.apiKey = directApiKey;

    const preview = await loadPostHogProjectFromConfig(
      companyId,
      config,
      { allowManualSnapshotFallback: false },
    );

    return {
      enabled: true,
      projectId,
      baseUrl,
      eventCount: preview.eventCount,
      activeUserTotal: preview.activeUserTotal,
      onboardingEvent: preview.onboardingEvent,
      onboardingEventCount: preview.onboardingEventCount,
      importantEvents: preview.importantEvents,
      importantEventCounts: preview.importantEventCounts,
      checkedAt: preview.checkedAt,
      usedSavedApiKey: !directApiKey,
    };
  }

  async function savePostHogSetup(
    companyId: string,
    input: {
      enabled: boolean;
      apiKey?: string | null;
      projectId?: string | null;
      baseUrl?: string | null;
      onboardingEvent?: string | null;
      importantEvents?: string[];
    },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "posthog") ?? null;
    if (!connector) {
      throw notFound("Officely PostHog connector not found");
    }

    const preview = await previewLivePostHogSetup(companyId, connector, input);
    const existingConfig = asConnectorConfig(connector);
    let apiKeySecretId = asString(existingConfig.apiKeySecretId);

    if (input.enabled && input.apiKey && input.apiKey.trim().length > 0) {
      const secret = await upsertNamedSecret(
        companyId,
        OFFICELY_POSTHOG_API_KEY_SECRET_NAME,
        input.apiKey.trim(),
        "PostHog API key for company-scoped analytics health checks.",
      );
      apiKeySecretId = secret.id;
    }

    if (input.enabled && !apiKeySecretId) {
      throw unprocessable("Add the PostHog API key before saving this setup.");
    }

    const configJson = mergeConnectorConfig(connector, {
      provider: "posthog_hogql",
      syncMode: "hogql_query",
      recommended: true,
      sourceOfTruthFor: ["product_usage"],
      enabled: input.enabled,
      apiKeySecretId,
      projectId: preview.projectId,
      baseUrl: preview.baseUrl,
      onboardingEvent: preview.onboardingEvent,
      importantEvents: preview.importantEvents,
      activityWindowDays: OFFICELY_POSTHOG_ACTIVITY_WINDOW_DAYS,
      lastCheckedAt: preview.checkedAt,
      lastHealthyAt: input.enabled ? preview.checkedAt : asString(existingConfig.lastHealthyAt),
    });

    await db
      .update(dataConnectors)
      .set({
        status: input.enabled ? "connected" : "planned",
        configSummary: summarizePostHogConnector(preview),
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectors.id, connector.id));

    return {
      companyId,
      connectorId: connector.id,
      enabled: input.enabled,
      hasSavedApiKey: Boolean(apiKeySecretId),
      projectId: preview.projectId,
      baseUrl: preview.baseUrl,
      eventCount: preview.eventCount,
      activeUserTotal: preview.activeUserTotal,
      onboardingEvent: preview.onboardingEvent,
      onboardingEventCount: preview.onboardingEventCount,
      importantEvents: preview.importantEvents,
      importantEventCounts: preview.importantEventCounts,
      usedSavedApiKey: preview.usedSavedApiKey,
      checkedAt: preview.checkedAt,
    };
  }

  async function testPostHogSetup(
    companyId: string,
    input: {
      enabled: boolean;
      apiKey?: string | null;
      projectId?: string | null;
      baseUrl?: string | null;
      onboardingEvent?: string | null;
      importantEvents?: string[];
    },
  ) {
    await assertOfficelyCompany(companyId);
    const connectors = await ensureV1Connectors(companyId);
    const connector = connectors.find((row) => row.kind === "posthog") ?? null;
    if (!connector) {
      throw notFound("Officely PostHog connector not found");
    }

    const preview = await previewLivePostHogSetup(companyId, connector, input);

    return {
      companyId,
      enabled: input.enabled,
      projectId: preview.projectId,
      baseUrl: preview.baseUrl,
      eventCount: preview.eventCount,
      activeUserTotal: preview.activeUserTotal,
      onboardingEvent: preview.onboardingEvent,
      onboardingEventCount: preview.onboardingEventCount,
      importantEvents: preview.importantEvents,
      importantEventCounts: preview.importantEventCounts,
      usedSavedApiKey: preview.usedSavedApiKey,
      checkedAt: preview.checkedAt,
    };
  }

  async function buildV1PayloadFromConnectors(companyId: string, connectorRows?: DataConnectorRow[]): Promise<OfficelyV1SyncPayload> {
    const rows = connectorRows ?? await ensureV1Connectors(companyId);
    const byKind = new Map(rows.map((row) => [row.kind, row]));
    const internalConnector = byKind.get("internal_database");
    const xeroConnector = byKind.get("xero");
    const stripeConnector = byKind.get("stripe");
    const [internalAccounts, xeroPreview, stripeEvents] = await Promise.all([
      internalConnector ? loadInternalDatabaseAccounts(companyId, internalConnector) : Promise.resolve([]),
      xeroConnector
        ? loadXeroInvoices(companyId, xeroConnector)
        : Promise.resolve({ invoices: [], cashReceipts: [] as OfficelyXeroCashReceiptRecord[] }),
      stripeConnector ? loadStripeEvents(companyId, stripeConnector) : Promise.resolve([]),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      internalAccounts,
      xeroInvoices: xeroPreview.invoices,
      xeroCashReceipts: xeroPreview.cashReceipts,
      stripeEvents,
      posthogAccounts: [],
    };
  }

  async function buildFounderBriefSnapshot(companyId: string, connectorRows: DataConnectorRow[], revenueScorecard: ReturnType<typeof calculateOfficelyRevenueScorecard>) {
    const byKind = new Map(connectorRows.map((row) => [row.kind, row]));
    const posthogConnector = byKind.get("posthog");
    const slackConnector = byKind.get("slack");

    let posthogProject: OfficelyPostHogProjectPulse | null = null;
    let slackFeedback: OfficelySlackFeedbackPulse | null = null;
    let slackFeedbackUnavailableReason: string | null = null;

    if (posthogConnector) {
      try {
        const preview = await loadPostHogProjectFromConfig(companyId, asConnectorConfig(posthogConnector));
        posthogProject = {
          checkedAt: preview.checkedAt,
          eventCount: preview.eventCount,
          activeUserTotal: preview.activeUserTotal,
          onboardingEvent: preview.onboardingEvent,
          onboardingEventCount: preview.onboardingEventCount,
          importantEventCounts: preview.importantEventCounts,
        };
      } catch {
        posthogProject = null;
      }
    }

    if (slackConnector) {
      try {
        const preview = await loadSlackFeedbackFromConfig(companyId, asConnectorConfig(slackConnector));
        slackFeedback = preview
          ? {
              checkedAt: preview.checkedAt,
              channelId: preview.channelId,
              channelsReviewed: preview.channelsReviewed,
              channelsWithMessages: preview.channelsWithMessages,
              messageCount: preview.messageCount,
              customerMessageCount: preview.customerMessageCount,
              customerFeedbackMessages: preview.customerFeedbackMessages,
              techIssueMessages: preview.techIssueMessages,
              bugMentions: preview.bugMentions,
              featureRequestMentions: preview.featureRequestMentions,
              churnRiskMentions: preview.churnRiskMentions,
              praiseMentions: preview.praiseMentions,
              supportMentions: preview.supportMentions,
              highlights: preview.highlights,
            }
          : null;
      } catch (error) {
        slackFeedback = null;
        slackFeedbackUnavailableReason = error instanceof Error
          ? `Slack feedback is not available on this sync: ${error.message}`
          : "Slack feedback is not available on this sync.";
      }
    }

    return generateOfficelyFounderBrief({
      generatedAt: new Date().toISOString(),
      revenueScorecard,
      posthogProject,
      slackFeedback,
      slackFeedbackUnavailableReason,
    });
  }

  async function syncV1Slice(companyId: string, payload: OfficelyV1SyncPayload) {
    await assertOfficelyCompany(companyId);
    const connectorRows = await ensureV1Connectors(companyId);
    const existingProfiles = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.companyId, companyId));

    const builtProfiles = buildOfficelyCustomerProfiles({
      existingProfiles: existingProfiles.map(buildProfileSeed),
      payload,
    });
    const revenueScorecard = calculateOfficelyRevenueScorecard(payload);
    const founderBrief = await buildFounderBriefSnapshot(companyId, connectorRows, revenueScorecard);
    const connectorIdMap = connectorIdsByKind(connectorRows);
    const insightDrafts = generateOfficelyInsightDrafts({
      payload,
      customerProfiles: builtProfiles,
    });

    await db.transaction(async (tx) => {
      for (const profile of builtProfiles) {
        const values = {
          companyId,
          companyName: profile.companyName,
          accountName: profile.accountName ?? null,
          workspaceId: profile.workspaceId ?? null,
          primaryEmailDomain: profile.primaryEmailDomain ?? null,
          planName: profile.planName ?? null,
          accountStatus: profile.accountStatus ?? null,
          firstSeenAt: profile.firstSeenAt ?? null,
          ownerUserId: profile.ownerUserId ?? null,
          hubspotCompanyId: profile.hubspotCompanyId ?? null,
          hubspotDealIds: [...(profile.hubspotDealIds ?? [])],
          stripeCustomerId: profile.stripeCustomerId ?? null,
          xeroContactId: profile.xeroContactId ?? null,
          intercomCompanyId: profile.intercomCompanyId ?? null,
          posthogGroupKey: profile.posthogGroupKey ?? null,
          internalAccountId: profile.internalAccountId ?? null,
          attributesJson: profile.attributesJson ?? {},
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        } satisfies Partial<typeof customerProfiles.$inferInsert>;

        if (profile.id) {
          await tx
            .update(customerProfiles)
            .set(values)
            .where(and(eq(customerProfiles.id, profile.id), eq(customerProfiles.companyId, companyId)));
        } else {
          await tx.insert(customerProfiles).values(values as typeof customerProfiles.$inferInsert);
        }
      }

      await tx
        .delete(insightCards)
        .where(and(eq(insightCards.companyId, companyId), inArray(insightCards.type, [...OFFICELY_V1_INSIGHT_TYPES])));

      if (insightDrafts.length > 0) {
        await tx.insert(insightCards).values(
          insightDrafts.map((draft) => toInsightInsert(companyId, connectorIdMap, draft)),
        );
      }

      await tx
        .update(companyProfiles)
        .set({
          operatingSnapshotJson: {
            revenueScorecard,
            founderBrief,
          },
          updatedAt: new Date(),
        })
        .where(eq(companyProfiles.companyId, companyId));

      for (const kind of OFFICELY_V1_CONNECTOR_KINDS) {
        if (!hasConnectorPayload(kind, payload)) continue;
        await tx
          .update(dataConnectors)
          .set({
            status: "syncing",
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(dataConnectors.companyId, companyId), eq(dataConnectors.kind, kind)));
      }
    });

    const profiles = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.companyId, companyId));
    const insights = await db
      .select()
      .from(insightCards)
      .where(and(eq(insightCards.companyId, companyId), inArray(insightCards.type, [...OFFICELY_V1_INSIGHT_TYPES])));

    return { profiles, insights, payload };
  }

  async function syncV1FromConnectors(companyId: string) {
    await assertOfficelyCompany(companyId);
    const connectorRows = await ensureV1Connectors(companyId);
    const payload = await buildV1PayloadFromConnectors(companyId, connectorRows);
    const result = await syncV1Slice(companyId, payload);
    const counts = {
      internalAccounts: payload.internalAccounts.length,
      xeroInvoices: payload.xeroInvoices.length,
      xeroCashReceipts: payload.xeroCashReceipts.length,
      stripeEvents: payload.stripeEvents.length,
      posthogAccounts: payload.posthogAccounts.length,
    };
    const [company, profile] = await Promise.all([
      db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, companyId))
        .then((rows) => rows[0] ?? null),
    ]);

    let knowledgeSnapshot:
      | {
          relativePath?: string;
          latestRelativePath?: string;
          error?: string;
        }
      | undefined;

    if (company && profile) {
      try {
        const exportResult = await writeOfficelyKnowledgeSnapshot({
          companyId,
          companyName: company.name,
          workspaceKey: profile.workspaceKey ?? null,
          connectorRows,
          operatingSnapshot: (profile.operatingSnapshotJson ?? {}) as Record<string, unknown>,
          profiles: result.profiles,
          insights: result.insights,
          payload,
          counts,
        });
        knowledgeSnapshot = {
          relativePath: exportResult.relativePath,
          latestRelativePath: exportResult.latestRelativePath,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown knowledge snapshot export failure";
        logger.warn({ err: error, companyId }, "Failed to export Officely knowledge snapshot");
        knowledgeSnapshot = { error: message };
      }
    }

    return {
      ...result,
      counts,
      knowledgeSnapshot,
    };
  }

  return {
    ensureV1Connectors,
    buildV1PayloadFromConnectors,
    loadInternalDatabaseAccounts,
    saveInternalDatabaseSetup,
    savePostHogSetup,
    saveSlackSetup,
    saveStripeSetup,
    saveXeroSetup,
    syncV1Slice,
    syncV1FromConnectors,
    testInternalDatabaseSetup,
    testPostHogSetup,
    testSlackSetup,
    testStripeSetup,
    testXeroSetup,
  };
}
