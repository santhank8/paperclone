/**
 * Effective config resolver for CLI commands.
 * Mirrors server's env-first config loading with precedence: env > config file > defaults.
 */
import { readConfig, resolveConfigPath } from "./store.js";
import { loadPaperclipEnvFile } from "./env.js";
import type { PaperclipConfig } from "./schema.js";

export interface EffectiveDeploymentConfig {
  deploymentMode: "local_trusted" | "authenticated";
  databaseUrl: string | null;
  publicBaseUrl: string | null;
  hasConfigFile: boolean;
  config: PaperclipConfig | null;
}

/**
 * Check if environment variables provide a complete config for authenticated mode.
 * This allows CLI commands to work without a config file in Docker/env-driven deployments.
 */
export function hasCompleteEnvConfig(): boolean {
  const hasDbUrl = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.trim().length > 0;
  const deploymentMode = process.env.PAPERCLIP_DEPLOYMENT_MODE;
  const hasDeploymentMode = deploymentMode === "authenticated" || deploymentMode === "local_trusted";
  const hasPublicUrl = Boolean(
    (process.env.PAPERCLIP_PUBLIC_URL?.trim()) ||
    (process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim()) ||
    (process.env.BETTER_AUTH_URL?.trim()) ||
    (process.env.BETTER_AUTH_BASE_URL?.trim())
  );

  // For authenticated mode, we need DATABASE_URL and deployment mode
  // Public URL is strongly recommended but not strictly required for bootstrap
  if (deploymentMode === "authenticated") {
    return hasDbUrl && hasDeploymentMode;
  }

  // For local_trusted mode with external postgres, DATABASE_URL is sufficient
  if (hasDbUrl) {
    return true;
  }

  return false;
}

/**
 * Resolve effective deployment config from env vars and optional config file.
 * Uses same precedence as server: env > config file > defaults.
 */
export function resolveEffectiveDeploymentConfig(configPath?: string): EffectiveDeploymentConfig {
  const resolvedPath = resolveConfigPath(configPath);
  loadPaperclipEnvFile(resolvedPath);

  const config = readConfig(configPath);
  const hasConfigFile = config !== null;

  // Resolve deployment mode: env > config > default
  const deploymentModeFromEnv = process.env.PAPERCLIP_DEPLOYMENT_MODE;
  const deploymentMode: "local_trusted" | "authenticated" =
    (deploymentModeFromEnv === "authenticated" || deploymentModeFromEnv === "local_trusted")
      ? deploymentModeFromEnv
      : config?.server.deploymentMode ?? "local_trusted";

  // Resolve database URL: env > config
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ??
    (config?.database.mode === "postgres" ? config.database.connectionString : null) ??
    null;

  // Resolve public base URL: env > config
  const publicBaseUrl =
    process.env.PAPERCLIP_PUBLIC_URL?.trim() ||
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    config?.auth.publicBaseUrl ||
    null;

  return {
    deploymentMode,
    databaseUrl,
    publicBaseUrl,
    hasConfigFile,
    config,
  };
}

/**
 * Get embedded postgres connection string from config or default.
 */
export function getEmbeddedPostgresUrl(config: PaperclipConfig | null): string | null {
  if (!config?.database || config.database.mode !== "embedded-postgres") {
    return null;
  }
  const port = config.database.embeddedPostgresPort ?? 54329;
  return `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
}
