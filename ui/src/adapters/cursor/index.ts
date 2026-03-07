import type { UIAdapterModule } from "../types";
import { parseCursorStdoutLine } from "@paperclipai/adapter-cursor-local/ui";
import { CursorLocalConfigFields } from "./config-fields";
import { buildCursorLocalConfig } from "@paperclipai/adapter-cursor-local/ui";

export const cursorLocalUIAdapter: UIAdapterModule = {
  type: "cursor",
  label: "Cursor CLI (local)",
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
  parseStdoutLine: parseCursorStdoutLine,
  ConfigFields: CursorLocalConfigFields,
  buildAdapterConfig: buildCursorLocalConfig,
};
