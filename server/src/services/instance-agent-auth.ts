import type { AgentAuthConfig } from "@paperclipai/shared";
import path from "node:path";
import { createDefaultConfigFile, readConfigFile } from "../config-file.js";
import { loadConfig } from "../config.js";

type AdapterConfigRecord = Record<string, unknown>;
type EnvBinding = { type: "plain"; value: string };

function asRecord(value: unknown): AdapterConfigRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as AdapterConfigRecord;
}

function envHasExplicitKey(env: AdapterConfigRecord, key: string): boolean {
  if (!(key in env)) return false;
  const value = env[key];
  if (typeof value === "string") return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as AdapterConfigRecord;
  if (record.type === "plain" && typeof record.value === "string") return true;
  if (record.type === "secret_ref" && typeof record.secretId === "string") return true;
  return false;
}

export function resolveCodexSharedSubscriptionHome(runtimeConfig = loadConfig()): string {
  return path.join(runtimeConfig.agentRuntimeDir, "_instance-auth", "codex");
}

export function resolveClaudeSharedSubscriptionHome(runtimeConfig = loadConfig()): string {
  return path.join(runtimeConfig.agentRuntimeDir, "_instance-auth", "claude");
}

function withCodexSharedHomeBindings(config: AdapterConfigRecord, sharedHomeDir: string): AdapterConfigRecord {
  let next = withEnvBinding(config, "CODEX_HOME", sharedHomeDir);
  // Keep HOME pinned to the same persistent directory so Codex auth state does not
  // drift into the container user's ephemeral home across different subcommands.
  next = withEnvBinding(next, "HOME", sharedHomeDir);
  return next;
}

function withEnvBinding(config: AdapterConfigRecord, key: string, value: string): AdapterConfigRecord {
  const env = asRecord(config.env);
  return {
    ...config,
    env: {
      ...env,
      [key]: {
        type: "plain",
        value,
      } satisfies EnvBinding,
    },
  };
}

function hasExplicitAuthMode(config: AdapterConfigRecord): boolean {
  const authMode = config.paperclipAuthMode;
  return authMode === "instance_api_key" || authMode === "subscription";
}

function authDefaultsFromFile(): AgentAuthConfig {
  return (readConfigFile() ?? createDefaultConfigFile()).agentAuth;
}

export function applyInstanceAgentCreateDefaults(
  adapterType: string | null | undefined,
  adapterConfig: AdapterConfigRecord,
  defaults: AgentAuthConfig = authDefaultsFromFile(),
): AdapterConfigRecord {
  if (hasExplicitAuthMode(adapterConfig)) return adapterConfig;

  if (adapterType === "claude_local") {
    const env = asRecord(adapterConfig.env);
    if (envHasExplicitKey(env, "ANTHROPIC_API_KEY")) return adapterConfig;
    return {
      ...adapterConfig,
      paperclipAuthMode: defaults.claudeLocal.useApiKey ? "instance_api_key" : "subscription",
    };
  }

  if (adapterType === "codex_local") {
    const env = asRecord(adapterConfig.env);
    if (envHasExplicitKey(env, "OPENAI_API_KEY")) return adapterConfig;
    return {
      ...adapterConfig,
      paperclipAuthMode: defaults.codexLocal.useApiKey ? "instance_api_key" : "subscription",
    };
  }

  return adapterConfig;
}

export function applyInstanceAgentRuntimeAuth(
  adapterType: string | null | undefined,
  adapterConfig: AdapterConfigRecord,
  runtimeConfig = loadConfig(),
): AdapterConfigRecord {
  const authMode = typeof adapterConfig.paperclipAuthMode === "string" ? adapterConfig.paperclipAuthMode : null;

  if (adapterType === "claude_local") {
    if (authMode === "instance_api_key" && runtimeConfig.claudeInstanceApiKey) {
      return withEnvBinding(adapterConfig, "ANTHROPIC_API_KEY", runtimeConfig.claudeInstanceApiKey);
    }
    if (authMode === "subscription") {
      let next = withEnvBinding(adapterConfig, "ANTHROPIC_API_KEY", "");
      const env = asRecord(next.env);
      if (!envHasExplicitKey(env, "CLAUDE_CONFIG_DIR")) {
        next = withEnvBinding(next, "CLAUDE_CONFIG_DIR", resolveClaudeSharedSubscriptionHome(runtimeConfig));
      }
      return next;
    }
  }

  if (adapterType === "codex_local") {
    if (authMode === "instance_api_key" && runtimeConfig.codexInstanceApiKey) {
      return withEnvBinding(adapterConfig, "OPENAI_API_KEY", runtimeConfig.codexInstanceApiKey);
    }
    if (authMode === "subscription") {
      let next = withEnvBinding(adapterConfig, "OPENAI_API_KEY", "");
      const env = asRecord(next.env);
      if (!envHasExplicitKey(env, "CODEX_HOME")) {
        next = withCodexSharedHomeBindings(next, resolveCodexSharedSubscriptionHome(runtimeConfig));
      }
      return next;
    }
  }

  return adapterConfig;
}
