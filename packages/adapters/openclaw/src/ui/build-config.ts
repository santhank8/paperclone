import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildOpenClawConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  ac.command = "openclaw";
  ac.agentId = (v as any).agentId || "main";
  if (v.cwd) ac.cwd = v.cwd;
  if (v.model) ac.model = v.model;
  if ((v as any).thinking) ac.thinking = (v as any).thinking;
  ac.timeoutSec = 600;
  ac.graceSec = 20;
  return ac;
}
