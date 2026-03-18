import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildCrcaQConfig(v: CreateConfigValues): Record<string, unknown> {
  const mode = (v.crcaExecutionMode ?? "disabled").trim().toLowerCase();
  const safeMode = ["disabled", "paper", "live"].includes(mode) ? mode : "disabled";
  const ac: Record<string, unknown> = {
    command: "crca-q",
    args: ["run", "--json"],
    timeoutSec: 900,
    graceSec: 15,
  };
  if (v.cwd) ac.cwd = v.cwd;
  ac.env = { CRCA_Q_EXECUTION_MODE: safeMode };
  return ac;
}
