import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agents, companies, costEvents, heartbeatRuns } from "@paperclipai/db";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import {
  type InstanceSettingsResponse,
  updateInstanceSettingsSchema,
} from "@paperclipai/shared";
import { createDefaultConfigFile, readConfigFile, writeConfigFile } from "../config-file.js";
import { loadConfig } from "../config.js";
import { validate } from "../middleware/validate.js";
import { resolvePaperclipConfigPath } from "../paths.js";
import {
  getClaudeInstanceSubscriptionAuth,
  probeClaudeInstanceConnection,
  startClaudeInstanceAuth,
} from "../services/claude-instance-subscription.js";
import {
  getCodexInstanceSubscriptionAuth,
  probeCodexInstanceConnection,
  startCodexInstanceDeviceAuth,
} from "../services/codex-instance-subscription.js";
import { assertBoard } from "./authz.js";

const effectiveCostCentsExpr = sql<number>`case
  when ${costEvents.billingType} = 'api'
    and ${costEvents.costCents} = 0
    and ${costEvents.calculatedCostCents} is not null
  then ${costEvents.calculatedCostCents}
  else ${costEvents.costCents}
end`;

function currentStorageEnvOverrides() {
  const flags = {
    provider: process.env.PAPERCLIP_STORAGE_PROVIDER !== undefined,
    localDiskBaseDir: process.env.PAPERCLIP_STORAGE_LOCAL_DIR !== undefined,
    s3Bucket: process.env.PAPERCLIP_STORAGE_S3_BUCKET !== undefined,
    s3Region: process.env.PAPERCLIP_STORAGE_S3_REGION !== undefined,
    s3Endpoint: process.env.PAPERCLIP_STORAGE_S3_ENDPOINT !== undefined,
    s3Prefix: process.env.PAPERCLIP_STORAGE_S3_PREFIX !== undefined,
    s3ForcePathStyle: process.env.PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE !== undefined,
    s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID !== undefined,
    s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY !== undefined,
    s3SessionToken: process.env.AWS_SESSION_TOKEN !== undefined,
    any: false,
  };
  flags.any = Object.values(flags).some((value) => value === true);
  return flags;
}

function currentSecretsEnvOverrides() {
  const flags = {
    provider: process.env.PAPERCLIP_SECRETS_PROVIDER !== undefined,
    strictMode: process.env.PAPERCLIP_SECRETS_STRICT_MODE !== undefined,
    localEncryptedKeyFilePath: process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE !== undefined,
    any: false,
  };
  flags.any = Object.values(flags).some((value) => value === true);
  return flags;
}

function currentDatabaseBackupEnvOverrides() {
  const flags = {
    enabled: process.env.PAPERCLIP_DB_BACKUP_ENABLED !== undefined,
    intervalMinutes: process.env.PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES !== undefined,
    retentionDays: process.env.PAPERCLIP_DB_BACKUP_RETENTION_DAYS !== undefined,
    dir: process.env.PAPERCLIP_DB_BACKUP_DIR !== undefined,
    any: false,
  };
  flags.any = Object.values(flags).some((value) => value === true);
  return flags;
}

function currentRuntimeEnvOverrides() {
  const flags = {
    heartbeatSchedulerEnabled: process.env.HEARTBEAT_SCHEDULER_ENABLED !== undefined,
    heartbeatSchedulerIntervalMs: process.env.HEARTBEAT_SCHEDULER_INTERVAL_MS !== undefined,
    agentRuntimeDir: process.env.PAPERCLIP_AGENT_RUNTIME_DIR !== undefined,
    agentRuntimeSyncEnabled: process.env.PAPERCLIP_AGENT_RUNTIME_SYNC_ENABLED !== undefined,
    agentRuntimeSyncIntervalMs: process.env.PAPERCLIP_AGENT_RUNTIME_SYNC_INTERVAL_MS !== undefined,
    any: false,
  };
  flags.any = Object.values(flags).some((value) => value === true);
  return flags;
}

function previewSecret(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function buildStorageAuthStatus(input: {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}) {
  return {
    hasAccessKeyId: Boolean(input.accessKeyId?.trim()),
    hasSecretAccessKey: Boolean(input.secretAccessKey?.trim()),
    hasSessionToken: Boolean(input.sessionToken?.trim()),
    accessKeyIdPreview: previewSecret(input.accessKeyId),
  };
}

function buildAgentAuthProfile(input: {
  useApiKey: boolean;
  apiKey?: string;
  subscriptionEstimate?: {
    enabled: boolean;
    windowHours: number;
    unit: "runs" | "input_tokens" | "total_tokens";
    capacity: number;
    extraCapacity: number;
  };
}) {
  return {
    useApiKey: input.useApiKey,
    hasApiKey: Boolean(input.apiKey?.trim()),
    apiKeyPreview: previewSecret(input.apiKey),
    subscriptionEstimate: input.subscriptionEstimate ?? {
      enabled: false,
      windowHours: 5,
      unit: "runs",
      capacity: 100,
      extraCapacity: 0,
    },
  };
}

async function buildSubscriptionUsageEstimate(
  db: Db,
  provider: "anthropic" | "openai",
  config: {
    enabled: boolean;
    windowHours: number;
    unit: "runs" | "input_tokens" | "total_tokens";
    capacity: number;
    extraCapacity: number;
  },
) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowHours * 60 * 60 * 1000);
  const [row] = await db
    .select({
      runCount: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
      oldestEventAt: sql<string | null>`min(${costEvents.occurredAt})::text`,
    })
    .from(costEvents)
    .where(
      and(
        eq(costEvents.billingType, "subscription"),
        eq(costEvents.provider, provider),
        gte(costEvents.occurredAt, windowStart),
      ),
    );

  const runCount = Number(row?.runCount ?? 0);
  const inputTokens = Number(row?.inputTokens ?? 0);
  const outputTokens = Number(row?.outputTokens ?? 0);
  const usedUnits =
    config.unit === "runs"
      ? runCount
      : config.unit === "input_tokens"
        ? inputTokens
        : inputTokens + outputTokens;
  const totalCapacityUnits = Math.max(1, Number(config.capacity ?? 0) + Number(config.extraCapacity ?? 0));
  const usagePercent = Number(((usedUnits / totalCapacityUnits) * 100).toFixed(1));
  const oldestEventAt = row?.oldestEventAt ? new Date(row.oldestEventAt) : null;
  const nextReliefAt = oldestEventAt
    ? new Date(oldestEventAt.getTime() + config.windowHours * 60 * 60 * 1000).toISOString()
    : null;

  return {
    provider,
    config,
    usedUnits,
    totalCapacityUnits,
    usagePercent,
    runCount,
    inputTokens,
    outputTokens,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    nextReliefAt,
  };
}

export function instanceSettingsRoutes(db: Db) {
  const router = Router();

  async function buildResponse(): Promise<InstanceSettingsResponse> {
    const fileConfig = readConfigFile() ?? createDefaultConfigFile();
    const runtimeConfig = loadConfig();
    const storageEnvOverrides = currentStorageEnvOverrides();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCompanies,
      activeCompanies,
      totalAgents,
      runningAgents,
      totalRuns7d,
      monthSpendCents,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(companies).then((rows) => Number(rows[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(companies).where(ne(companies.status, "archived")).then((rows) => Number(rows[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(agents).then((rows) => Number(rows[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.status, "running")).then((rows) => Number(rows[0]?.count ?? 0)),
      db.select({ count: sql<number>`count(*)` }).from(heartbeatRuns).where(gte(heartbeatRuns.createdAt, sevenDaysAgo)).then((rows) => Number(rows[0]?.count ?? 0)),
      db.select({ total: sql<number>`coalesce(sum(${effectiveCostCentsExpr}), 0)::int` }).from(costEvents).where(gte(costEvents.occurredAt, monthStart)).then((rows) => Number(rows[0]?.total ?? 0)),
    ]);

    return {
      configPath: resolvePaperclipConfigPath(),
      storage: {
        configured: {
          provider: fileConfig.storage.provider,
          localDisk: fileConfig.storage.localDisk,
          s3: {
            bucket: fileConfig.storage.s3.bucket,
            region: fileConfig.storage.s3.region,
            endpoint: fileConfig.storage.s3.endpoint,
            prefix: fileConfig.storage.s3.prefix,
            forcePathStyle: fileConfig.storage.s3.forcePathStyle,
          },
        },
        effective: {
          provider: runtimeConfig.storageProvider,
          localDiskBaseDir: runtimeConfig.storageLocalDiskBaseDir,
          s3Bucket: runtimeConfig.storageS3Bucket,
          s3Region: runtimeConfig.storageS3Region,
          s3Endpoint: runtimeConfig.storageS3Endpoint ?? null,
          s3Prefix: runtimeConfig.storageS3Prefix,
          s3ForcePathStyle: runtimeConfig.storageS3ForcePathStyle,
        },
        auth: {
          configured: buildStorageAuthStatus(fileConfig.storageAuth.s3),
          effective: {
            ...buildStorageAuthStatus({
              accessKeyId: runtimeConfig.storageS3AccessKeyId,
              secretAccessKey: runtimeConfig.storageS3SecretAccessKey,
              sessionToken: runtimeConfig.storageS3SessionToken,
            }),
            source:
              runtimeConfig.storageS3AccessKeyId && runtimeConfig.storageS3SecretAccessKey
                ? storageEnvOverrides.s3AccessKeyId || storageEnvOverrides.s3SecretAccessKey
                  ? "environment"
                  : "instance_config"
                : "default_chain",
          },
        },
        envOverrides: storageEnvOverrides,
      },
      secrets: {
        configured: fileConfig.secrets,
        effective: {
          provider: runtimeConfig.secretsProvider,
          strictMode: runtimeConfig.secretsStrictMode,
          masterKeyFilePath: runtimeConfig.secretsMasterKeyFilePath,
        },
        envOverrides: currentSecretsEnvOverrides(),
      },
      database: {
        configuredBackup: fileConfig.database.backup,
        effectiveBackup: {
          enabled: runtimeConfig.databaseBackupEnabled,
          intervalMinutes: runtimeConfig.databaseBackupIntervalMinutes,
          retentionDays: runtimeConfig.databaseBackupRetentionDays,
          dir: runtimeConfig.databaseBackupDir,
        },
        envOverrides: currentDatabaseBackupEnvOverrides(),
      },
      runtime: {
        configured: fileConfig.runtime,
        deploymentMode: runtimeConfig.deploymentMode,
        deploymentExposure: runtimeConfig.deploymentExposure,
        databaseMode: runtimeConfig.databaseMode,
        heartbeatSchedulerEnabled: runtimeConfig.heartbeatSchedulerEnabled,
        heartbeatSchedulerIntervalMs: runtimeConfig.heartbeatSchedulerIntervalMs,
        agentRuntimeSyncEnabled: runtimeConfig.agentRuntimeSyncEnabled,
        agentRuntimeSyncIntervalMs: runtimeConfig.agentRuntimeSyncIntervalMs,
        agentRuntimeDir: runtimeConfig.agentRuntimeDir,
        envOverrides: currentRuntimeEnvOverrides(),
      },
      agentAuth: {
        configured: {
          claudeLocal: buildAgentAuthProfile(fileConfig.agentAuth.claudeLocal),
          codexLocal: buildAgentAuthProfile(fileConfig.agentAuth.codexLocal),
        },
        usage: {
          claudeLocal: await buildSubscriptionUsageEstimate(
            db,
            "anthropic",
            fileConfig.agentAuth.claudeLocal.subscriptionEstimate ?? {
              enabled: false,
              windowHours: 5,
              unit: "runs",
              capacity: 100,
              extraCapacity: 0,
            },
          ),
          codexLocal: await buildSubscriptionUsageEstimate(
            db,
            "openai",
            fileConfig.agentAuth.codexLocal.subscriptionEstimate ?? {
              enabled: false,
              windowHours: 5,
              unit: "runs",
              capacity: 100,
              extraCapacity: 0,
            },
          ),
        },
      },
      metrics: {
        totalCompanies,
        activeCompanies,
        totalAgents,
        runningAgents,
        totalRuns7d,
        monthSpendCents,
      },
    };
  }

  router.get("/instance/settings", async (req, res) => {
    assertBoard(req);
    res.json(await buildResponse());
  });

  router.get("/instance/settings/provider-auth/codex/subscription", async (req, res) => {
    assertBoard(req);
    res.json(await getCodexInstanceSubscriptionAuth());
  });

  router.get("/instance/settings/provider-auth/claude/subscription", async (req, res) => {
    assertBoard(req);
    res.json(await getClaudeInstanceSubscriptionAuth());
  });

  router.post("/instance/settings/provider-auth/codex/subscription/start", async (req, res) => {
    assertBoard(req);
    await startCodexInstanceDeviceAuth();
    res.json(await getCodexInstanceSubscriptionAuth());
  });

  router.post("/instance/settings/provider-auth/claude/subscription/start", async (req, res) => {
    assertBoard(req);
    await startClaudeInstanceAuth();
    res.json(await getClaudeInstanceSubscriptionAuth());
  });

  router.post("/instance/settings/provider-auth/claude/test-api-key", async (req, res) => {
    assertBoard(req);
    const apiKeyOverride =
      typeof req.body?.apiKey === "string" && req.body.apiKey.trim().length > 0
        ? req.body.apiKey.trim()
        : null;
    res.json(await probeClaudeInstanceConnection("api_key", { apiKeyOverride }));
  });

  router.post("/instance/settings/provider-auth/claude/test-subscription", async (req, res) => {
    assertBoard(req);
    res.json(await probeClaudeInstanceConnection("subscription"));
  });

  router.post("/instance/settings/provider-auth/codex/test-api-key", async (req, res) => {
    assertBoard(req);
    const apiKeyOverride =
      typeof req.body?.apiKey === "string" && req.body.apiKey.trim().length > 0
        ? req.body.apiKey.trim()
        : null;
    res.json(await probeCodexInstanceConnection("api_key", { apiKeyOverride }));
  });

  router.post("/instance/settings/provider-auth/codex/test-subscription", async (req, res) => {
    assertBoard(req);
    res.json(await probeCodexInstanceConnection("subscription"));
  });

  router.patch("/instance/settings", validate(updateInstanceSettingsSchema), async (req, res) => {
    assertBoard(req);
    const current = readConfigFile() ?? createDefaultConfigFile();
    writeConfigFile({
      ...current,
      $meta: {
        ...current.$meta,
        updatedAt: new Date().toISOString(),
        source: "configure",
      },
      storage: req.body.storage ?? current.storage,
      storageAuth: req.body.storageAuth?.s3
        ? {
            ...current.storageAuth,
            s3: req.body.storageAuth.s3.clear
              ? {}
              : {
                  ...current.storageAuth.s3,
                  ...(req.body.storageAuth.s3.accessKeyId !== undefined
                    ? { accessKeyId: req.body.storageAuth.s3.accessKeyId.trim() }
                    : {}),
                  ...(req.body.storageAuth.s3.secretAccessKey !== undefined
                    ? { secretAccessKey: req.body.storageAuth.s3.secretAccessKey.trim() }
                    : {}),
                  ...(req.body.storageAuth.s3.sessionToken !== undefined
                    ? { sessionToken: req.body.storageAuth.s3.sessionToken.trim() }
                    : {}),
                },
          }
        : current.storageAuth,
      secrets: req.body.secrets ?? current.secrets,
      database: {
        ...current.database,
        ...(req.body.databaseBackup ? { backup: req.body.databaseBackup } : {}),
      },
      runtime: req.body.runtime ?? current.runtime,
      agentAuth: {
        ...current.agentAuth,
        ...(req.body.agentAuth?.claudeLocal
          ? {
              claudeLocal: {
                ...current.agentAuth.claudeLocal,
                useApiKey: req.body.agentAuth.claudeLocal.useApiKey,
                ...(req.body.agentAuth.claudeLocal.clearApiKey
                  ? { apiKey: undefined }
                  : req.body.agentAuth.claudeLocal.apiKey !== undefined
                    ? { apiKey: req.body.agentAuth.claudeLocal.apiKey.trim() }
                    : {}),
                ...(req.body.agentAuth.claudeLocal.subscriptionEstimate
                  ? { subscriptionEstimate: req.body.agentAuth.claudeLocal.subscriptionEstimate }
                  : {}),
              },
            }
          : {}),
        ...(req.body.agentAuth?.codexLocal
          ? {
              codexLocal: {
                ...current.agentAuth.codexLocal,
                useApiKey: req.body.agentAuth.codexLocal.useApiKey,
                ...(req.body.agentAuth.codexLocal.clearApiKey
                  ? { apiKey: undefined }
                  : req.body.agentAuth.codexLocal.apiKey !== undefined
                    ? { apiKey: req.body.agentAuth.codexLocal.apiKey.trim() }
                    : {}),
                ...(req.body.agentAuth.codexLocal.subscriptionEstimate
                  ? { subscriptionEstimate: req.body.agentAuth.codexLocal.subscriptionEstimate }
                  : {}),
              },
            }
          : {}),
      },
    });
    res.json({
      ok: true,
      settings: await buildResponse(),
    });
  });

  return router;
}
