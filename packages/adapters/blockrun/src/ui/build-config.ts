import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildBlockRunConfig(
  v: CreateConfigValues,
): Record<string, unknown> {
  const ac: Record<string, unknown> = {};

  if (v.url) ac.apiUrl = v.url;

  ac.timeoutSec = 120;
  ac.maxTokens = 4096;
  ac.temperature = 0.7;
  ac.network = "mainnet";
  ac.routingMode = "balanced";

  if (v.model) ac.model = v.model;

  return ac;
}
