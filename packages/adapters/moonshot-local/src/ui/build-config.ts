import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { DEFAULT_MOONSHOT_LOCAL_MODEL, DEFAULT_MOONSHOT_BASE_URL } from "../index.js";

function parseEnvBindings(bindings: unknown): Record<string, unknown> {
  if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) return {};
  const env: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(bindings)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (typeof raw === "string") { env[key] = { type: "plain", value: raw }; continue; }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    if (rec.type === "plain" && typeof rec.value === "string") { env[key] = { type: "plain", value: rec.value }; continue; }
    if (rec.type === "secret_ref" && typeof rec.secretId === "string") {
      env[key] = { type: "secret_ref", secretId: rec.secretId, ...(typeof rec.version === "number" || rec.version === "latest" ? { version: rec.version } : {}) };
    }
  }
  return env;
}

export function buildMoonshotLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  ac.model = v.model || DEFAULT_MOONSHOT_LOCAL_MODEL;
  ac.baseUrl = DEFAULT_MOONSHOT_BASE_URL;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  if (v.bootstrapPrompt) ac.bootstrapPromptTemplate = v.bootstrapPrompt;
  const env = parseEnvBindings(v.envBindings);
  if (Object.keys(env).length > 0) ac.env = env;
  return ac;
}
