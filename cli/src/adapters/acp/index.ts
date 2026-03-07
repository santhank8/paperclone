import type { CLIAdapterModule } from "@paperclipai/adapter-utils";
import { printAcpStdoutEvent } from "./format-event.js";

export const acpCLIAdapter: CLIAdapterModule = {
  type: "acp",
  formatStdoutEvent: printAcpStdoutEvent,
};
