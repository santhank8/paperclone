import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function parseDeepSeekStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) return [{ kind: "stdout", ts, text: line }];

  const type = asString(parsed.type);

  if (type === "system") {
    const subtype = asString(parsed.subtype);
    if (subtype === "init") {
      return [{ kind: "init", ts, model: asString(parsed.model, "deepseek"), sessionId: asString(parsed.session_id) }];
    }
    if (subtype === "error") {
      return [{ kind: "stderr", ts, text: asString(asRecord(parsed.error)?.message ?? parsed.error, "error") }];
    }
    return [{ kind: "system", ts, text: `system: ${subtype || "event"}` }];
  }

  if (type === "assistant") {
    const msg = asRecord(parsed.message);
    const text = msg ? asString(msg.text) : "";
    return text ? [{ kind: "assistant", ts, text, delta: parsed.delta === true }] : [];
  }

  if (type === "thinking") {
    const text = asString(parsed.text);
    return text ? [{ kind: "thinking", ts, text, delta: parsed.delta === true }] : [];
  }

  if (type === "result") {
    const usage = asRecord(parsed.usage) ?? {};
    return [{
      kind: "result",
      ts,
      text: asString(parsed.result),
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens),
      cachedTokens: asNumber(usage.cached_input_tokens),
      costUsd: asNumber(parsed.total_cost_usd, asNumber(parsed.cost_usd)),
      subtype: asString(parsed.subtype, "result"),
      isError: parsed.is_error === true,
      errors: parsed.is_error === true ? [asString(parsed.error)] .filter(Boolean) : [],
    }];
  }

  if (type === "error") {
    return [{ kind: "stderr", ts, text: asString(parsed.error, "error") }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
