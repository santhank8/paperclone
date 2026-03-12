import type { UIAdapterModule } from "../types";
import { parseBlockRunStdoutLine } from "@paperclipai/adapter-blockrun/ui";
import { buildBlockRunConfig } from "@paperclipai/adapter-blockrun/ui";
import { BlockRunConfigFields } from "./config-fields";

export const blockRunUIAdapter: UIAdapterModule = {
  type: "blockrun",
  label: "BlockRun",
  parseStdoutLine: parseBlockRunStdoutLine,
  ConfigFields: BlockRunConfigFields,
  buildAdapterConfig: buildBlockRunConfig,
};
