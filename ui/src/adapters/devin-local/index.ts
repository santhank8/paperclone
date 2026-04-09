import type { UIAdapterModule } from "../types";
import { parseDevinLocalStdoutLine } from "@paperclipai/adapter-devin-local/ui";
import { buildDevinLocalConfig } from "@paperclipai/adapter-devin-local/ui";
import { models } from "@paperclipai/adapter-devin-local";
import { DevinLocalConfigFields } from "./config-fields";

export const devinLocalUIAdapter: UIAdapterModule = {
  type: "devin_local",
  label: "Devin (local)",
  parseStdoutLine: parseDevinLocalStdoutLine,
  ConfigFields: DevinLocalConfigFields,
  buildAdapterConfig: buildDevinLocalConfig,
  models,
};
