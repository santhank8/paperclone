import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function normalize(line: string): string {
  return line.trim();
}

export function parsePicoClawStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const text = normalize(line);
  if (!text) return [];
  if (text.startsWith("🦐 ")) {
    return [{ kind: "assistant", ts, text: text.slice(3) }];
  }
  if (/^error:/i.test(text)) {
    return [{ kind: "stderr", ts, text }];
  }
  return [{ kind: "stdout", ts, text }];
}
