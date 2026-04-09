import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function parseDevinLocalStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  return [{ kind: "assistant", ts, text: line }];
}
