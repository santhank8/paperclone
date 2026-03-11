import { describe, expect, it } from "vitest";
import type { AgentAuthConfig } from "@paperclipai/shared";
import type { Config } from "../config.js";
import {
  applyInstanceAgentCreateDefaults,
  applyInstanceAgentRuntimeAuth,
  resolveClaudeSharedSubscriptionHome,
  resolveCodexSharedSubscriptionHome,
} from "../services/instance-agent-auth.js";

function runtimeConfig(overrides: Partial<Config> = {}): Config {
  return {
    deploymentMode: "local_trusted",
    deploymentExposure: "private",
    host: "127.0.0.1",
    port: 3100,
    allowedHostnames: [],
    authBaseUrlMode: "auto",
    authPublicBaseUrl: undefined,
    authDisableSignUp: false,
    databaseMode: "embedded-postgres",
    databaseUrl: undefined,
    embeddedPostgresDataDir: "/tmp/db",
    embeddedPostgresPort: 54329,
    databaseBackupEnabled: true,
    databaseBackupIntervalMinutes: 60,
    databaseBackupRetentionDays: 30,
    databaseBackupDir: "/tmp/backups",
    serveUi: true,
    uiDevMiddleware: false,
    secretsProvider: "local_encrypted",
    secretsStrictMode: false,
    secretsMasterKeyFilePath: "/tmp/master.key",
    storageProvider: "local_disk",
    storageLocalDiskBaseDir: "/tmp/storage",
    storageS3Bucket: "paperclip",
    storageS3Region: "us-east-1",
    storageS3Endpoint: undefined,
    storageS3Prefix: "",
    storageS3ForcePathStyle: false,
    storageS3AccessKeyId: undefined,
    storageS3SecretAccessKey: undefined,
    storageS3SessionToken: undefined,
    heartbeatSchedulerEnabled: true,
    heartbeatSchedulerIntervalMs: 30000,
    companyDeletionEnabled: true,
    agentRuntimeDir: "/tmp/agent-runtime",
    agentRuntimeSyncEnabled: true,
    agentRuntimeSyncIntervalMs: 300000,
    claudeInstanceUseApiKey: false,
    claudeInstanceApiKey: undefined,
    codexInstanceUseApiKey: false,
    codexInstanceApiKey: undefined,
    ...overrides,
  };
}

const instanceDefaults: AgentAuthConfig = {
  claudeLocal: {
    useApiKey: true,
    apiKey: "sk-ant-test",
  },
  codexLocal: {
    useApiKey: false,
  },
};

describe("instance agent auth defaults", () => {
  it("tags new claude_local agents to use the instance API key by default", () => {
    const result = applyInstanceAgentCreateDefaults("claude_local", {}, instanceDefaults);
    expect(result.paperclipAuthMode).toBe("instance_api_key");
  });

  it("tags new codex_local agents for subscription mode when API key usage is off", () => {
    const result = applyInstanceAgentCreateDefaults("codex_local", {}, instanceDefaults);
    expect(result.paperclipAuthMode).toBe("subscription");
  });

  it("does not override an explicit adapter env key", () => {
    const result = applyInstanceAgentCreateDefaults(
      "claude_local",
      {
        env: {
          ANTHROPIC_API_KEY: { type: "plain", value: "agent-specific" },
        },
      },
      instanceDefaults,
    );
    expect(result.paperclipAuthMode).toBeUndefined();
  });

  it("preserves an explicit per-agent auth mode on create", () => {
    const result = applyInstanceAgentCreateDefaults(
      "codex_local",
      { paperclipAuthMode: "instance_api_key" },
      instanceDefaults,
    );
    expect(result.paperclipAuthMode).toBe("instance_api_key");
  });

  it("injects the stored Anthropic key at runtime for instance_api_key mode", () => {
    const result = applyInstanceAgentRuntimeAuth(
      "claude_local",
      { paperclipAuthMode: "instance_api_key" },
      runtimeConfig({
        claudeInstanceUseApiKey: true,
        claudeInstanceApiKey: "sk-ant-live",
      }),
    );
    expect(result.env).toEqual({
      ANTHROPIC_API_KEY: {
        type: "plain",
        value: "sk-ant-live",
      },
    });
  });

  it("forces subscription mode by blanking the inherited host key", () => {
    const runtime = runtimeConfig();
    const result = applyInstanceAgentRuntimeAuth(
      "codex_local",
      { paperclipAuthMode: "subscription" },
      runtimeConfig({
        codexInstanceUseApiKey: false,
      }),
    );
    expect(result.env).toEqual({
      CODEX_HOME: {
        type: "plain",
        value: resolveCodexSharedSubscriptionHome(runtime),
      },
      HOME: {
        type: "plain",
        value: resolveCodexSharedSubscriptionHome(runtime),
      },
      OPENAI_API_KEY: {
        type: "plain",
        value: "",
      },
    });
  });

  it("mounts the shared Claude config dir for subscription mode", () => {
    const result = applyInstanceAgentRuntimeAuth(
      "claude_local",
      { paperclipAuthMode: "subscription" },
      runtimeConfig({
        claudeInstanceUseApiKey: false,
      }),
    );
    expect(result.env).toEqual({
      ANTHROPIC_API_KEY: {
        type: "plain",
        value: "",
      },
      CLAUDE_CONFIG_DIR: {
        type: "plain",
        value: resolveClaudeSharedSubscriptionHome(runtimeConfig()),
      },
    });
  });

  it("leaves legacy automatic mode unchanged at runtime", () => {
    const result = applyInstanceAgentRuntimeAuth(
      "claude_local",
      {},
      runtimeConfig({
        claudeInstanceUseApiKey: true,
        claudeInstanceApiKey: "sk-ant-live",
      }),
    );
    expect(result).toEqual({});
  });
});
