// Changes: Centralized UI allowlists for invite join, agent adapter picker, and issue assignee overrides (includes openclaw_gateway).
import type { AgentAdapterType } from "@paperclipai/shared";

/** Adapters selectable on the invite landing join flow (vs "Coming soon"). */
export const ENABLED_INVITE_ADAPTER_TYPES = new Set<AgentAdapterType>([
  "claude_local",
  "codex_local",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "hermes_local",
  "openclaw_gateway",
]);

/** Adapters selectable in agent configuration (vs coming-soon in the dropdown). */
export const ENABLED_AGENT_CONFIG_ADAPTER_TYPES = new Set<AgentAdapterType>([
  "claude_local",
  "codex_local",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "hermes_local",
  "openclaw_gateway",
]);

/** Adapters that support per-issue assignee adapter/model overrides in New Issue. */
export const ISSUE_OVERRIDE_ADAPTER_TYPES = new Set<AgentAdapterType>([
  "claude_local",
  "codex_local",
  "opencode_local",
  "openclaw_gateway",
]);
