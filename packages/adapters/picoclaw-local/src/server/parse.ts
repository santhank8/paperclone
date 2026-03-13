const ANSI_RE = /\u001B\[[0-9;]*m/g;

function normalizeLine(line: string): string {
  return line.replace(ANSI_RE, "").trim();
}

export function extractPicoClawSummary(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^█/.test(line))
    .filter((line) => !/^╚|^╔|^╝|^═/.test(line));

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/^Agent initialized$/i.test(line)) continue;
    if (/^Debug mode enabled$/i.test(line)) continue;
    if (line.startsWith("🦐 ")) return line.slice(3).trim() || null;
    return line;
  }
  return null;
}

export function isPicoClawUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .join("\n");

  return /unknown\s+session|session\s+not\s+found|session\s+.*\s+not\s+found|no\s+session/i.test(haystack);
}
