import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function parseEventLine(line: string, ts: string): TranscriptEntry[] {
  const match = line.match(
    /^\[blockrun:event\]\s+run=([^\s]+)\s+stream=([^\s]+)\s+data=(.*)$/s,
  );
  if (!match) return [{ kind: "stdout", ts, text: line }];

  const stream = asString(match[2]).toLowerCase();
  const data = asRecord(safeJsonParse(asString(match[3]).trim()));

  if (stream === "assistant") {
    const delta = asString(data?.delta);
    if (delta.length > 0) {
      return [{ kind: "assistant", ts, text: delta, delta: true }];
    }
    const text = asString(data?.text);
    if (text.length > 0) {
      return [{ kind: "assistant", ts, text }];
    }
    return [];
  }

  if (stream === "error") {
    const message = asString(data?.error) || asString(data?.message);
    return message ? [{ kind: "stderr", ts, text: message }] : [];
  }

  return [];
}

export function parseBlockRunStdoutLine(
  line: string,
  ts: string,
): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[blockrun:event]")) {
    return parseEventLine(trimmed, ts);
  }

  if (trimmed.startsWith("[blockrun]")) {
    return [
      {
        kind: "system",
        ts,
        text: trimmed.replace(/^\[blockrun\]\s*/, ""),
      },
    ];
  }

  return [{ kind: "stdout", ts, text: trimmed }];
}
