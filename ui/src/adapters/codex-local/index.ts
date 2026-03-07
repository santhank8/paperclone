import type { UIAdapterModule } from "../types";
import { parseCodexStdoutLine } from "@paperclipai/adapter-codex-local/ui";
import { CodexLocalConfigFields } from "./config-fields";
import { buildCodexLocalConfig } from "@paperclipai/adapter-codex-local/ui";

export const codexLocalUIAdapter: UIAdapterModule = {
  type: "codex_local",
  label: "Codex (local)",
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
  parseStdoutLine: parseCodexStdoutLine,
  ConfigFields: CodexLocalConfigFields,
  buildAdapterConfig: buildCodexLocalConfig,
};
