import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "@paperclipai/adapter-claude-local/ui";
import { ClaudeLocalConfigFields } from "./config-fields";
import { buildClaudeLocalConfig } from "@paperclipai/adapter-claude-local/ui";

export const claudeLocalUIAdapter: UIAdapterModule = {
  type: "claude_local",
  label: "Claude Code (local)",
  capabilities: {
    command: true,
    model: true,
    thinkingEffort: true,
    cwd: true,
    promptTemplate: true,
    bootstrapPrompt: true,
    extraArgs: true,
    envVars: true,
    timeout: true,
    gracePeriod: true,
  },
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: ClaudeLocalConfigFields,
  buildAdapterConfig: buildClaudeLocalConfig,
};
