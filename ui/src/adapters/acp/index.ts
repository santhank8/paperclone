import type { UIAdapterModule } from "../types";
import { parseAcpStdoutLine } from "./parse-stdout";
import { AcpConfigFields } from "./config-fields";
import { buildAcpConfig } from "./build-config";

export const acpUIAdapter: UIAdapterModule = {
  type: "acp",
  label: "ACP (Agent Client Protocol)",
  capabilities: {
    command: true,
    model: true,
    cwd: true,
    promptTemplate: true,
    envVars: true,
    timeout: true,
  },
  parseStdoutLine: parseAcpStdoutLine,
  ConfigFields: AcpConfigFields,
  buildAdapterConfig: buildAcpConfig,
};
