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
  generateOfficelyInsightDrafts,
  type OfficelyCustomerProfileSeed,
  type OfficelyInsightDraft,
  type OfficelyInternalAccountRecord,
  type OfficelyPostHogAccountRecord,
  type OfficelyStripeEventRecord,
  type OfficelyV1SyncPayload,
  type OfficelyXeroInvoiceRecord,
} from "@paperclipai/virtual-org-connectors";
import { VIRTUAL_ORG_SEED_COMPANIES } from "@paperclipai/virtual-org-core";
import { notFound, unprocessable } from "../errors.js";
import { secretService } from "./secrets.js";

const OFFICELY_V1_CONNECTOR_KINDS = ["internal_database", "xero", "stripe", "posthog"] as const;
const OFFICELY_BOOTSTRAP_CONNECTOR_KINDS = ["slack", ...OFFICELY_V1_CONNECTOR_KINDS] as const;
const OFFICELY_V1_INSIGHT_TYPES = [
  "officely_v1_booked_revenue",
  "officely_v1_manual_revenue",
  "officely_v1_billing_events",
  "officely_v1_usage_risk",
] as const;
const OFFICELY_INTERNAL_DB_MAX_ROWS = 5_000;
const OFFICELY_INTERNAL_DB_STATEMENT_TIMEOUT_MS = 10_000;
const OFFICELY_INTERNAL_DB_LOCK_TIMEOUT_MS = 2_000;
const OFFICELY_INTERNAL_DB_SECRET_NAME = "OFFICELY_INTERNAL_DATABASE_URL";
const OFFICELY_SQL_WRITE_RE =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|merge|call|vacuum|analyze|comment|refresh|reindex|cluster|discard|listen|notify)\b/i;

type OfficelyConnectorKind = (typeof OFFICELY_V1_CONNECTOR_KINDS)[number];
type DataConnectorRow = typeof dataConnectors.$inferSelect;
type JsonRecord = Record<string, unknown>;

function hasConnectorPayload(kind: OfficelyConnectorKind, payload: OfficelyV1SyncPayload) {
  if (kind === "internal_database") return payload.internalAccounts.length > 0;
  if (kind === "xero") return payload.xeroInvoices.length > 0;
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

  async function upsertInternalDatabaseSecret(companyId: string, connectionString: string) {
    const existing = await secrets.getByName(companyId, OFFICELY_INTERNAL_DB_SECRET_NAME);
    if (!existing) {
      return secrets.create(companyId, {
        name: OFFICELY_INTERNAL_DB_SECRET_NAME,
        provider: "local_encrypted",
        value: connectionString,
        description: "Read-only connection string for Officely customer identity sync.",
      });
    }

    await secrets.rotate(existing.id, { value: connectionString });
    return secrets.getById(existing.id).then((secret) => {
      if (!secret) throw notFound("Secret not found after rotation");
      return secret;
    });
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

  async function buildV1PayloadFromConnectors(companyId: string, connectorRows?: DataConnectorRow[]): Promise<OfficelyV1SyncPayload> {
    const rows = connectorRows ?? await ensureV1Connectors(companyId);
    const byKind = new Map(rows.map((row) => [row.kind, row]));
    const internalConnector = byKind.get("internal_database");

    return {
      generatedAt: new Date().toISOString(),
      internalAccounts: internalConnector ? await loadInternalDatabaseAccounts(companyId, internalConnector) : [],
      xeroInvoices: asConnectorConfigArray<OfficelyXeroInvoiceRecord>(byKind.get("xero"), "manualSnapshot"),
      stripeEvents: asConnectorConfigArray<OfficelyStripeEventRecord>(byKind.get("stripe"), "manualSnapshot"),
      posthogAccounts: asConnectorConfigArray<OfficelyPostHogAccountRecord>(byKind.get("posthog"), "manualSnapshot"),
    };
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

    return {
      ...result,
      counts: {
        internalAccounts: payload.internalAccounts.length,
        xeroInvoices: payload.xeroInvoices.length,
        stripeEvents: payload.stripeEvents.length,
        posthogAccounts: payload.posthogAccounts.length,
      },
    };
  }

  return {
    ensureV1Connectors,
    buildV1PayloadFromConnectors,
    loadInternalDatabaseAccounts,
    saveInternalDatabaseSetup,
    syncV1Slice,
    syncV1FromConnectors,
    testInternalDatabaseSetup,
  };
}
