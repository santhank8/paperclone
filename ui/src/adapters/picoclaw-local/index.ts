import type { UIAdapterModule } from "../types";
import { parsePicoClawStdoutLine } from "@paperclipai/adapter-picoclaw-local/ui";
import { buildPicoClawLocalConfig } from "@paperclipai/adapter-picoclaw-local/ui";
import { PicoClawLocalConfigFields } from "./config-fields";

export const picoClawLocalUIAdapter: UIAdapterModule = {
  type: "picoclaw_local",
  label: "PicoClaw (local)",
  parseStdoutLine: parsePicoClawStdoutLine,
  ConfigFields: PicoClawLocalConfigFields,
  buildAdapterConfig: buildPicoClawLocalConfig,
};
