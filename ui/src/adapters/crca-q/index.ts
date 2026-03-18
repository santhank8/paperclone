import type { UIAdapterModule } from "../types";
import { parseProcessStdoutLine } from "../process/parse-stdout";
import { CrcaQConfigFields } from "./config-fields";
import { buildCrcaQConfig } from "./build-config";

export const crcaQUIAdapter: UIAdapterModule = {
  type: "crca_q",
  label: "CRCA-Q (quant)",
  parseStdoutLine: parseProcessStdoutLine,
  ConfigFields: CrcaQConfigFields,
  buildAdapterConfig: buildCrcaQConfig,
};
