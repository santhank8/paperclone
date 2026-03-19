import { readConfig, configExists, resolveConfigPath } from "../config/store.js";
import { hasCompleteEnvConfig } from "../config/effective.js";
import type { CheckResult } from "./index.js";

export function configCheck(configPath?: string): CheckResult {
  const filePath = resolveConfigPath(configPath);

  if (!configExists(configPath)) {
    // Check if env vars provide complete config for env-driven deployments
    if (hasCompleteEnvConfig()) {
      return {
        name: "Config file",
        status: "warn",
        message: `No config file at ${filePath}, but environment variables provide complete configuration`,
        canRepair: false,
        repairHint: "Optional: run `paperclipai onboard` to create a config file for local customization",
      };
    }

    return {
      name: "Config file",
      status: "fail",
      message: `Config file not found at ${filePath}`,
      canRepair: false,
      repairHint: "Run `paperclipai onboard` to create one, or set DATABASE_URL and PAPERCLIP_DEPLOYMENT_MODE environment variables",
    };
  }

  try {
    readConfig(configPath);
    return {
      name: "Config file",
      status: "pass",
      message: `Valid config at ${filePath}`,
    };
  } catch (err) {
    return {
      name: "Config file",
      status: "fail",
      message: `Invalid config: ${err instanceof Error ? err.message : String(err)}`,
      canRepair: false,
      repairHint: "Run `paperclipai configure --section database` (or `paperclipai onboard` to recreate)",
    };
  }
}
