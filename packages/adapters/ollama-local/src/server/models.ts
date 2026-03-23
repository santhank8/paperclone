import type { AdapterModel } from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

type OllamaTag = {
  name?: unknown;
  model?: unknown;
};

type OllamaTagsResponse = {
  models?: OllamaTag[];
};

type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
};

const MODELS_CACHE_TTL_MS = 30_000;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 15_000;
const DEFAULT_CHAT_TIMEOUT_MS = 120_000;
const discoveryCache = new Map<string, { expiresAt: number; models: AdapterModel[] }>();

function dedupeModels(models: AdapterModel[]) {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const entry of models) {
    const id = entry.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: entry.label.trim() || id });
  }
  return deduped;
}

function sortModels(models: AdapterModel[]) {
  return [...models].sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true, sensitivity: "base" }),
  );
}

function firstNonEmptyLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function pruneExpiredDiscoveryCache(now: number) {
  for (const [key, entry] of discoveryCache.entries()) {
    if (entry.expiresAt <= now) discoveryCache.delete(key);
  }
}

function parseModelId(tag: OllamaTag): string {
  const candidates = [tag.name, tag.model];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return "";
}

async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = firstNonEmptyLine(text);
      throw new Error(detail ? `${response.status} ${response.statusText}: ${detail}` : `${response.status} ${response.statusText}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Ollama returned invalid JSON.");
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBasePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return /\/v1$/i.test(trimmed) ? trimmed.slice(0, -3) : trimmed;
}

export function normalizeOllamaBaseUrl(input: unknown): string {
  const raw = asString(
    input,
    typeof process.env.OLLAMA_HOST === "string" && process.env.OLLAMA_HOST.trim().length > 0
      ? process.env.OLLAMA_HOST
      : DEFAULT_OLLAMA_BASE_URL,
  ).trim();
  const parsed = new URL(raw || DEFAULT_OLLAMA_BASE_URL);
  const normalizedPath = normalizeBasePath(parsed.pathname || "");
  return `${parsed.origin}${normalizedPath}`;
}

function buildApiUrl(baseUrl: string, pathname: string) {
  return `${normalizeOllamaBaseUrl(baseUrl)}${pathname}`;
}

export async function discoverOllamaModels(input: {
  baseUrl?: unknown;
  timeoutMs?: number;
} = {}): Promise<AdapterModel[]> {
  const baseUrl = normalizeOllamaBaseUrl(input.baseUrl);
  const data = await fetchJson<OllamaTagsResponse>(buildApiUrl(baseUrl, "/api/tags"), {
    method: "GET",
    timeoutMs: input.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS,
  });
  const parsed = Array.isArray(data.models)
    ? data.models
        .map((entry) => parseModelId(entry))
        .filter(Boolean)
        .map((id) => ({ id, label: id }))
    : [];
  return sortModels(dedupeModels(parsed));
}

export async function discoverOllamaModelsCached(input: {
  baseUrl?: unknown;
  timeoutMs?: number;
} = {}): Promise<AdapterModel[]> {
  const baseUrl = normalizeOllamaBaseUrl(input.baseUrl);
  const now = Date.now();
  pruneExpiredDiscoveryCache(now);
  const cached = discoveryCache.get(baseUrl);
  if (cached && cached.expiresAt > now) return cached.models;
  const models = await discoverOllamaModels({
    baseUrl,
    timeoutMs: input.timeoutMs,
  });
  discoveryCache.set(baseUrl, {
    expiresAt: now + MODELS_CACHE_TTL_MS,
    models,
  });
  return models;
}

export async function ensureOllamaModelConfiguredAndAvailable(input: {
  model?: unknown;
  baseUrl?: unknown;
  allowUndiscoveredModel?: unknown;
}): Promise<AdapterModel[]> {
  const model = asString(input.model, "").trim();
  if (!model) {
    throw new Error("Ollama requires `adapterConfig.model`.");
  }

  const allowUndiscoveredModel = input.allowUndiscoveredModel === true;
  let models: AdapterModel[] = [];
  try {
    models = await discoverOllamaModelsCached({
      baseUrl: input.baseUrl,
    });
  } catch (err) {
    if (allowUndiscoveredModel) return [];
    throw err;
  }

  if (models.length === 0) {
    if (allowUndiscoveredModel) return [];
    throw new Error("Ollama returned no local models from /api/tags.");
  }

  if (!models.some((entry) => entry.id === model)) {
    if (allowUndiscoveredModel) return models;
    const sample = models.slice(0, 12).map((entry) => entry.id).join(", ");
    throw new Error(
      `Configured Ollama model is unavailable: ${model}. Available models: ${sample}${models.length > 12 ? ", ..." : ""}`,
    );
  }

  return models;
}

export async function listOllamaModels(): Promise<AdapterModel[]> {
  try {
    return await discoverOllamaModelsCached();
  } catch {
    return [];
  }
}

export async function chatWithOllama(input: {
  baseUrl?: unknown;
  model: string;
  messages: OllamaChatMessage[];
  timeoutMs?: number;
}): Promise<OllamaChatResponse> {
  const baseUrl = normalizeOllamaBaseUrl(input.baseUrl);
  return fetchJson<OllamaChatResponse>(buildApiUrl(baseUrl, "/api/chat"), {
    method: "POST",
    timeoutMs: input.timeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS,
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: false,
    }),
  });
}

export function resetOllamaModelsCacheForTests() {
  discoveryCache.clear();
}
