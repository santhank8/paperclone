import type { UIAdapterModule } from "../types";
import { parseAcpStdoutLine } from "../acp/parse-stdout";
import { KiroCliConfigFields } from "./config-fields";
import { buildKiroCliConfig } from "./build-config";

export const kiroCliUIAdapter: UIAdapterModule = {
  type: "kiro_cli",
  label: "Kiro CLI (local)",
  capabilities: {
    command: true,
    model: true,
    cwd: true,
    promptTemplate: true,
    envVars: true,
    timeout: true,
  },
  parseStdoutLine: parseAcpStdoutLine,
  ConfigFields: KiroCliConfigFields,
  buildAdapterConfig: buildKiroCliConfig,
};
