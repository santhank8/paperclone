import type { UIAdapterModule } from "../types";
import { parseOpenCodeStdoutLine } from "@paperclipai/adapter-opencode-local/ui";
import { OpenCodeLocalConfigFields } from "./config-fields";
import { buildOpenCodeLocalConfig } from "@paperclipai/adapter-opencode-local/ui";

export const openCodeLocalUIAdapter: UIAdapterModule = {
  type: "opencode_local",
  label: "OpenCode (local)",
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
  parseStdoutLine: parseOpenCodeStdoutLine,
  ConfigFields: OpenCodeLocalConfigFields,
  buildAdapterConfig: buildOpenCodeLocalConfig,
};
