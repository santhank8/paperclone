/**
 * Build adapter configuration from UI form values.
 *
 * Translates Paperclip's CreateConfigValues into the adapterConfig
 * object stored in the agent record.
 */

import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { DEFAULT_TIMEOUT_SEC } from "../server/constants.js";

/**
 * Build a Hermes Agent adapter config from the Paperclip UI form values.
 *
 * When model is empty/falsy, we omit it from the config so the server-side
 * adapter can detect the current Hermes default from ~/.hermes/config.yaml.
 */
export function buildHermesConfig(
  values: CreateConfigValues
): Record<string, unknown> {
  const ac: Record<string, unknown> = {};

  // Model: only include if explicitly set (non-empty and not "auto")
  // Empty or "auto" means "detect from Hermes config"
  if (values.model && values.model.trim().length > 0 && values.model !== "auto") {
    ac.model = values.model;
  }

  // Execution limits
  ac.timeoutSec = DEFAULT_TIMEOUT_SEC;
  ac.persistSession = true;

  // Working directory
  if (values.cwd) {
    ac.cwd = values.cwd;
  }

  // Custom hermes binary path
  if (values.command) {
    ac.hermesCommand = values.command;
  }

  // Extra CLI arguments
  if (values.extraArgs) {
    ac.extraArgs = values.extraArgs.split(/\s+/).filter(Boolean);
  }

  // Thinking/reasoning effort
  if (values.thinkingEffort) {
    const existing = (ac.extraArgs as string[]) || [];
    existing.push("--reasoning-effort", String(values.thinkingEffort));
    ac.extraArgs = existing;
  }

  // Provider from args field (CreateConfigValues convention)
  if (values.args && values.args.trim().length > 0) {
    ac.provider = values.args.trim();
  }

  // Prompt template
  if (values.promptTemplate) {
    ac.promptTemplate = values.promptTemplate;
  }

  return ac;
}