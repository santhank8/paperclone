import pc from "picocolors";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function printPicoClawStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  const parsed = asRecord(safeJsonParse(line));
  if (parsed) {
    console.log(line);
    return;
  }

  if (line.startsWith("🦐 ")) {
    console.log(pc.cyan(line.slice(3)));
    return;
  }

  if (/^error:/i.test(line)) {
    console.log(pc.red(line));
    return;
  }

  console.log(line);
}
