import type { UIAdapterModule } from "../types";
import { parseCursorStdoutLine, buildCursorLocalConfig } from "@paperclipai/adapter-cursor-local/ui";
import { CursorLocalConfigFields } from "./config-fields";
import { label } from "@paperclipai/adapter-cursor-local";

export const cursorLocalUIAdapter: UIAdapterModule = {
  type: "cursor_local",
  label,
  parseStdoutLine: parseCursorStdoutLine,
  ConfigFields: CursorLocalConfigFields,
  buildAdapterConfig: buildCursorLocalConfig,
};
