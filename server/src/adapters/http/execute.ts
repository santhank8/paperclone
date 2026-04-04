import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

function truncate(value: string, max = 500): string {
  return value.length > max ? value.slice(0, max) : value;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;
  const url = asString(config.url, "");
  if (!url) throw new Error("HTTP adapter missing url");

  const method = asString(config.method, "POST");
  const timeoutMs = asNumber(config.timeoutMs, 0);
  const headers = parseObject(config.headers) as Record<string, string>;
  const payloadTemplate = parseObject(config.payloadTemplate);
  const body = { ...payloadTemplate, agentId: agent.id, runId, context };

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      ...(timer ? { signal: controller.signal } : {}),
    });

    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      const json = JSON.parse(text) as unknown;
      if (json && typeof json === "object" && !Array.isArray(json)) {
        parsed = json as Record<string, unknown>;
      }
    } catch {
      // ignore non-JSON responses
    }

    if (!res.ok) {
      const detail = parsed?.error ?? truncate(text, 300);
      throw new Error(`HTTP invoke failed with status ${res.status}${detail ? `: ${String(detail)}` : ""}`);
    }

    const summary =
      (typeof parsed?.summary === "string" && parsed.summary) ||
      (typeof parsed?.result === "string" && parsed.result) ||
      (typeof parsed?.message === "string" && parsed.message) ||
      (text.trim() ? truncate(text.trim()) : `HTTP ${method} ${url}`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary,
      resultJson: parsed ?? (text.trim() ? { result: truncate(text.trim(), 4000) } : undefined),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
