import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine, buildClaudeLocalConfig } from "@paperclipai/adapter-claude-local-openrouter/ui";
import { ClaudeLocalOpenrouterConfigFields } from "./config-fields";

export const claudeLocalOpenrouterUIAdapter: UIAdapterModule = {
  type: "claude_local_openrouter",
  label: "Claude Code (local, OpenRouter Qwen)",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: ClaudeLocalOpenrouterConfigFields,
  buildAdapterConfig: buildClaudeLocalConfig,
};
