import type {
  DatabaseBackupConfig,
  RuntimeConfig,
  SecretsConfig,
  StorageConfig,
} from "../config-schema.js";
import type { DeploymentExposure, DeploymentMode, SecretProvider, StorageProvider } from "../constants.js";

export interface InstanceSettingsStorageEnvOverrides {
  provider: boolean;
  localDiskBaseDir: boolean;
  s3Bucket: boolean;
  s3Region: boolean;
  s3Endpoint: boolean;
  s3Prefix: boolean;
  s3ForcePathStyle: boolean;
  s3AccessKeyId: boolean;
  s3SecretAccessKey: boolean;
  s3SessionToken: boolean;
  any: boolean;
}

export interface InstanceSettingsSecretsEnvOverrides {
  provider: boolean;
  strictMode: boolean;
  localEncryptedKeyFilePath: boolean;
  any: boolean;
}

export interface InstanceSettingsDatabaseBackupEnvOverrides {
  enabled: boolean;
  intervalMinutes: boolean;
  retentionDays: boolean;
  dir: boolean;
  any: boolean;
}

export interface InstanceSettingsRuntimeEnvOverrides {
  heartbeatSchedulerEnabled: boolean;
  heartbeatSchedulerIntervalMs: boolean;
  agentRuntimeDir: boolean;
  agentRuntimeSyncEnabled: boolean;
  agentRuntimeSyncIntervalMs: boolean;
  any: boolean;
}

export interface InstanceSettingsMetrics {
  totalCompanies: number;
  activeCompanies: number;
  totalAgents: number;
  runningAgents: number;
  totalRuns7d: number;
  monthSpendCents: number;
}

export interface InstanceSettingsRedactedStorageConfig {
  provider: StorageConfig["provider"];
  localDisk: StorageConfig["localDisk"];
  s3: Omit<StorageConfig["s3"], never>;
}

export interface InstanceSettingsStorageAuthStatus {
  hasAccessKeyId: boolean;
  hasSecretAccessKey: boolean;
  hasSessionToken: boolean;
  accessKeyIdPreview: string | null;
}

export interface InstanceSettingsAgentAuthProfile {
  useApiKey: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  subscriptionEstimate: InstanceSubscriptionUsageEstimateConfig;
}

export interface InstanceSubscriptionUsageEstimateConfig {
  enabled: boolean;
  windowHours: number;
  unit: "runs" | "input_tokens" | "total_tokens";
  capacity: number;
  extraCapacity: number;
}

export interface InstanceSubscriptionUsageEstimateStatus {
  provider: "anthropic" | "openai";
  config: InstanceSubscriptionUsageEstimateConfig;
  usedUnits: number;
  totalCapacityUnits: number;
  usagePercent: number;
  runCount: number;
  inputTokens: number;
  outputTokens: number;
  windowStart: string;
  windowEnd: string;
  nextReliefAt: string | null;
}

export interface InstanceCodexSubscriptionStatus {
  command: string;
  sharedHomeDir: string;
  checkedAt: string;
  loggedIn: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface InstanceClaudeSubscriptionStatus {
  command: string;
  sharedConfigDir: string;
  checkedAt: string;
  loggedIn: boolean;
  authMethod: string | null;
  apiProvider: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface InstanceClaudeAuthSession {
  state: "idle" | "pending" | "succeeded" | "failed";
  loginUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

export interface InstanceClaudeSubscriptionAuthResponse {
  command: string;
  sharedConfigDir: string;
  session: InstanceClaudeAuthSession;
  loginStatus: InstanceClaudeSubscriptionStatus;
}

export interface InstanceClaudeConnectionProbeResult {
  mode: "api_key" | "subscription";
  command: string;
  sharedConfigDir: string | null;
  checkedAt: string;
  ok: boolean;
  exitCode: number | null;
  summary: string;
  detail: string | null;
  stdout: string;
  stderr: string;
}

export interface InstanceCodexDeviceAuthSession {
  state: "idle" | "pending" | "succeeded" | "failed";
  loginUrl: string | null;
  userCode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

export interface InstanceCodexSubscriptionAuthResponse {
  command: string;
  sharedHomeDir: string;
  session: InstanceCodexDeviceAuthSession;
  loginStatus: InstanceCodexSubscriptionStatus;
}

export interface InstanceCodexConnectionProbeResult {
  mode: "api_key" | "subscription";
  command: string;
  sharedHomeDir: string | null;
  checkedAt: string;
  ok: boolean;
  exitCode: number | null;
  summary: string;
  detail: string | null;
  stdout: string;
  stderr: string;
}

export interface InstanceSettingsResponse {
  configPath: string;
  storage: {
    configured: InstanceSettingsRedactedStorageConfig;
    effective: {
      provider: StorageProvider;
      localDiskBaseDir: string;
      s3Bucket: string;
      s3Region: string;
      s3Endpoint: string | null;
      s3Prefix: string;
      s3ForcePathStyle: boolean;
    };
    auth: {
      configured: InstanceSettingsStorageAuthStatus;
      effective: InstanceSettingsStorageAuthStatus & {
        source: "instance_config" | "environment" | "default_chain";
      };
    };
    envOverrides: InstanceSettingsStorageEnvOverrides;
  };
  secrets: {
    configured: SecretsConfig;
    effective: {
      provider: SecretProvider;
      strictMode: boolean;
      masterKeyFilePath: string;
    };
    envOverrides: InstanceSettingsSecretsEnvOverrides;
  };
  database: {
    configuredBackup: DatabaseBackupConfig;
    effectiveBackup: DatabaseBackupConfig;
    envOverrides: InstanceSettingsDatabaseBackupEnvOverrides;
  };
  runtime: {
    configured: RuntimeConfig;
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    databaseMode: "embedded-postgres" | "postgres";
    heartbeatSchedulerEnabled: boolean;
    heartbeatSchedulerIntervalMs: number;
    agentRuntimeSyncEnabled: boolean;
    agentRuntimeSyncIntervalMs: number;
    agentRuntimeDir: string;
    envOverrides: InstanceSettingsRuntimeEnvOverrides;
  };
  agentAuth: {
    configured: {
      claudeLocal: InstanceSettingsAgentAuthProfile;
      codexLocal: InstanceSettingsAgentAuthProfile;
    };
    usage: {
      claudeLocal: InstanceSubscriptionUsageEstimateStatus;
      codexLocal: InstanceSubscriptionUsageEstimateStatus;
    };
  };
  metrics: InstanceSettingsMetrics;
}

export interface UpdateInstanceStorageAuthSettings {
  s3?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    clear?: boolean;
  };
}

export interface UpdateInstanceAgentAuthSettings {
  claudeLocal?: {
    useApiKey: boolean;
    apiKey?: string;
    clearApiKey?: boolean;
    subscriptionEstimate?: InstanceSubscriptionUsageEstimateConfig;
  };
  codexLocal?: {
    useApiKey: boolean;
    apiKey?: string;
    clearApiKey?: boolean;
    subscriptionEstimate?: InstanceSubscriptionUsageEstimateConfig;
  };
}
