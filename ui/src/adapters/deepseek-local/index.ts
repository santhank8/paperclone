import type { UIAdapterModule } from "../types";
import { parseDeepSeekStdoutLine } from "@paperclipai/adapter-deepseek-local/ui";
import { DeepSeekLocalConfigFields } from "./config-fields";
import { buildDeepSeekLocalConfig } from "@paperclipai/adapter-deepseek-local/ui";

export const deepseekLocalUIAdapter: UIAdapterModule = {
  type: "deepseek_local",
  label: "DeepSeek (深度求索)",
  parseStdoutLine: parseDeepSeekStdoutLine,
  ConfigFields: DeepSeekLocalConfigFields,
  buildAdapterConfig: buildDeepSeekLocalConfig,
};
