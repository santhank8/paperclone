import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { buildClaudeLocalConfig } from "@paperclipai/adapter-claude-local/ui";

export function buildHybridLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  // Start with the Claude config (handles cwd, model, env, workspace, etc.)
  const ac = buildClaudeLocalConfig(v);
  return ac;
}
