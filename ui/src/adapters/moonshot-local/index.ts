import type { UIAdapterModule } from "../types";
import { parseMoonshotStdoutLine } from "@paperclipai/adapter-moonshot-local/ui";
import { MoonshotLocalConfigFields } from "./config-fields";
import { buildMoonshotLocalConfig } from "@paperclipai/adapter-moonshot-local/ui";

export const moonshotLocalUIAdapter: UIAdapterModule = {
  type: "moonshot_local",
  label: "Kimi / 月之暗面 (Moonshot)",
  parseStdoutLine: parseMoonshotStdoutLine,
  ConfigFields: MoonshotLocalConfigFields,
  buildAdapterConfig: buildMoonshotLocalConfig,
};
