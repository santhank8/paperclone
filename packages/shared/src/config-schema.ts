import { z } from "zod";
import {
  AUTH_BASE_URL_MODES,
  DEPLOYMENT_EXPOSURES,
  DEPLOYMENT_MODES,
  SECRET_PROVIDERS,
  STORAGE_PROVIDERS,
} from "./constants.js";

export const configMetaSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  source: z.enum(["onboard", "configure", "doctor"]),
});

export const llmConfigSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  apiKey: z.string().optional(),
});

export const databaseBackupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intervalMinutes: z.number().int().min(1).max(7 * 24 * 60).default(60),
  retentionDays: z.number().int().min(1).max(3650).default(30),
  dir: z.string().default("~/.paperclip/instances/default/data/backups"),
});

export const databaseConfigSchema = z.object({
  mode: z.enum(["embedded-postgres", "postgres"]).default("embedded-postgres"),
  connectionString: z.string().optional(),
  embeddedPostgresDataDir: z.string().default("~/.paperclip/instances/default/db"),
  embeddedPostgresPort: z.number().int().min(1).max(65535).default(54329),
  backup: databaseBackupConfigSchema.default({
    enabled: true,
    intervalMinutes: 60,
    retentionDays: 30,
    dir: "~/.paperclip/instances/default/data/backups",
  }),
});

export const loggingConfigSchema = z.object({
  mode: z.enum(["file", "cloud"]),
  logDir: z.string().default("~/.paperclip/instances/default/logs"),
});

export const serverConfigSchema = z.object({
  deploymentMode: z.enum(DEPLOYMENT_MODES).default("local_trusted"),
  exposure: z.enum(DEPLOYMENT_EXPOSURES).default("private"),
  host: z.string().default("127.0.0.1"),
  port: z.number().int().min(1).max(65535).default(3100),
  allowedHostnames: z.array(z.string().min(1)).default([]),
  serveUi: z.boolean().default(true),
});

export const authConfigSchema = z.object({
  baseUrlMode: z.enum(AUTH_BASE_URL_MODES).default("auto"),
  publicBaseUrl: z.string().url().optional(),
  disableSignUp: z.boolean().default(false),
});

export const storageLocalDiskConfigSchema = z.object({
  baseDir: z.string().default("~/.paperclip/instances/default/data/storage"),
});

export const storageS3ConfigSchema = z.object({
  bucket: z.string().min(1).default("paperclip"),
  region: z.string().min(1).default("us-east-1"),
  endpoint: z.string().optional(),
  prefix: z.string().default(""),
  forcePathStyle: z.boolean().default(false),
});

export const storageAuthConfigSchema = z.object({
  s3: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    sessionToken: z.string().optional(),
  }).default({}),
});

export const storageConfigSchema = z.object({
  provider: z.enum(STORAGE_PROVIDERS).default("local_disk"),
  localDisk: storageLocalDiskConfigSchema.default({
    baseDir: "~/.paperclip/instances/default/data/storage",
  }),
  s3: storageS3ConfigSchema.default({
    bucket: "paperclip",
    region: "us-east-1",
    prefix: "",
    forcePathStyle: false,
  }),
});

export const secretsLocalEncryptedConfigSchema = z.object({
  keyFilePath: z.string().default("~/.paperclip/instances/default/secrets/master.key"),
});

export const secretsConfigSchema = z.object({
  provider: z.enum(SECRET_PROVIDERS).default("local_encrypted"),
  strictMode: z.boolean().default(false),
  localEncrypted: secretsLocalEncryptedConfigSchema.default({
    keyFilePath: "~/.paperclip/instances/default/secrets/master.key",
  }),
});

export const heartbeatSchedulerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intervalMs: z.number().int().min(10000).max(24 * 60 * 60 * 1000).default(30000),
});

export const agentRuntimeConfigSchema = z.object({
  dir: z.string().default("~/.paperclip/instances/default/agent-runtime"),
  syncEnabled: z.boolean().default(true),
  syncIntervalMs: z.number().int().min(60000).max(24 * 60 * 60 * 1000).default(5 * 60 * 1000),
});

export const runtimeConfigSchema = z.object({
  heartbeatScheduler: heartbeatSchedulerConfigSchema.default({
    enabled: true,
    intervalMs: 30000,
  }),
  agentRuntime: agentRuntimeConfigSchema.default({
    dir: "~/.paperclip/instances/default/agent-runtime",
    syncEnabled: true,
    syncIntervalMs: 5 * 60 * 1000,
  }),
});

export const agentAuthProfileConfigSchema = z.object({
  useApiKey: z.boolean().default(false),
  apiKey: z.string().optional(),
  subscriptionEstimate: z.object({
    enabled: z.boolean().default(false),
    windowHours: z.number().int().min(1).max(24 * 30).default(5),
    unit: z.enum(["runs", "input_tokens", "total_tokens"]).default("runs"),
    capacity: z.number().int().positive().default(100),
    extraCapacity: z.number().int().nonnegative().default(0),
  }).default({
    enabled: false,
    windowHours: 5,
    unit: "runs",
    capacity: 100,
    extraCapacity: 0,
  }),
});

export const agentAuthConfigSchema = z.object({
  claudeLocal: agentAuthProfileConfigSchema.default({
    useApiKey: false,
  }),
  codexLocal: agentAuthProfileConfigSchema.default({
    useApiKey: false,
  }),
});

export const paperclipConfigSchema = z
  .object({
    $meta: configMetaSchema,
    llm: llmConfigSchema.optional(),
    database: databaseConfigSchema,
    logging: loggingConfigSchema,
    server: serverConfigSchema,
    auth: authConfigSchema.default({
      baseUrlMode: "auto",
      disableSignUp: false,
    }),
    storage: storageConfigSchema.default({
      provider: "local_disk",
      localDisk: {
        baseDir: "~/.paperclip/instances/default/data/storage",
      },
      s3: {
        bucket: "paperclip",
        region: "us-east-1",
        prefix: "",
        forcePathStyle: false,
      },
    }),
    storageAuth: storageAuthConfigSchema.default({
      s3: {},
    }),
    secrets: secretsConfigSchema.default({
      provider: "local_encrypted",
      strictMode: false,
      localEncrypted: {
        keyFilePath: "~/.paperclip/instances/default/secrets/master.key",
      },
    }),
    runtime: runtimeConfigSchema.default({
      heartbeatScheduler: {
        enabled: true,
        intervalMs: 30000,
      },
      agentRuntime: {
        dir: "~/.paperclip/instances/default/agent-runtime",
        syncEnabled: true,
        syncIntervalMs: 5 * 60 * 1000,
      },
    }),
    agentAuth: agentAuthConfigSchema.default({
      claudeLocal: {
        useApiKey: false,
      },
      codexLocal: {
        useApiKey: false,
      },
    }),
  })
  .superRefine((value, ctx) => {
    if (value.server.deploymentMode === "local_trusted") {
      if (value.server.exposure !== "private") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "server.exposure must be private when deploymentMode is local_trusted",
          path: ["server", "exposure"],
        });
      }
      return;
    }

    if (value.auth.baseUrlMode === "explicit" && !value.auth.publicBaseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auth.publicBaseUrl is required when auth.baseUrlMode is explicit",
        path: ["auth", "publicBaseUrl"],
      });
    }

    if (value.server.exposure === "public" && value.auth.baseUrlMode !== "explicit") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auth.baseUrlMode must be explicit when deploymentMode=authenticated and exposure=public",
        path: ["auth", "baseUrlMode"],
      });
    }

    if (value.server.exposure === "public" && !value.auth.publicBaseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auth.publicBaseUrl is required when deploymentMode=authenticated and exposure=public",
        path: ["auth", "publicBaseUrl"],
      });
    }
  });

export type PaperclipConfig = z.infer<typeof paperclipConfigSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type StorageConfig = z.infer<typeof storageConfigSchema>;
export type StorageAuthConfig = z.infer<typeof storageAuthConfigSchema>;
export type StorageLocalDiskConfig = z.infer<typeof storageLocalDiskConfigSchema>;
export type StorageS3Config = z.infer<typeof storageS3ConfigSchema>;
export type SecretsConfig = z.infer<typeof secretsConfigSchema>;
export type SecretsLocalEncryptedConfig = z.infer<typeof secretsLocalEncryptedConfigSchema>;
export type HeartbeatSchedulerConfig = z.infer<typeof heartbeatSchedulerConfigSchema>;
export type AgentRuntimeConfig = z.infer<typeof agentRuntimeConfigSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
export type AgentAuthProfileConfig = z.infer<typeof agentAuthProfileConfigSchema>;
export type AgentAuthConfig = z.infer<typeof agentAuthConfigSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type ConfigMeta = z.infer<typeof configMetaSchema>;
export type DatabaseBackupConfig = z.infer<typeof databaseBackupConfigSchema>;
