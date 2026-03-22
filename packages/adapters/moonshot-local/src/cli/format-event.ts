import pc from "picocolors";

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

export function printMoonshotStreamEvent(line: string, debug: boolean): void {
  const parsed = typeof line === "string" ? safeJsonParse(line) : null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (line.trim()) process.stdout.write(line + "\n");
    return;
  }
  const rec = parsed as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : "";

  if (type === "assistant") {
    const msg = typeof rec.message === "object" && rec.message !== null ? rec.message as Record<string, unknown> : null;
    const text = msg && typeof msg.text === "string" ? msg.text : "";
    if (text) process.stdout.write(text);
    return;
  }

  if (type === "thinking") {
    const text = typeof rec.text === "string" ? rec.text : "";
    if (text) process.stdout.write(pc.dim(text));
    return;
  }

  if (type === "result") {
    process.stdout.write("\n");
    return;
  }

  if (type === "error") {
    const err = typeof rec.error === "string" ? rec.error : JSON.stringify(rec.error);
    process.stderr.write(pc.red(`错误: ${err}\n`));
    return;
  }

  if (type === "system") {
    if (debug) {
      process.stderr.write(pc.dim(`[system] ${JSON.stringify(rec)}\n`));
    }
    return;
  }

  if (debug) {
    process.stderr.write(pc.dim(`[moonshot] ${line}\n`));
  }
}
