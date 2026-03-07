import type { CreateConfigValues } from "../types";

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildKiroCliConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  ac.command = v.command || "kiro-cli";
  if (v.args) {
    ac.args = parseCommaArgs(v.args);
  }
  if (v.cwd) ac.cwd = v.cwd;
  if (v.model) ac.model = v.model;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  const ext = v as unknown as Record<string, unknown>;
  if (ext.agent) ac.agent = ext.agent;
  if (ext.trustAllTools) ac.trustAllTools = true;
  const timeout = parseInt(v.timeoutSec ?? "", 10);
  ac.timeoutSec = isNaN(timeout) ? 0 : timeout;
  return ac;
}
