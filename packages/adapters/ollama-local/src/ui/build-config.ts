import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildOllamaLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (v.instructionsFilePath) config.instructionsFilePath = v.instructionsFilePath;
  if (v.promptTemplate) config.promptTemplate = v.promptTemplate;
  if (v.url) config.baseUrl = v.url;
  if (v.model) config.model = v.model;
  if (v.allowUndiscoveredModel) config.allowUndiscoveredModel = true;
  return config;
}
