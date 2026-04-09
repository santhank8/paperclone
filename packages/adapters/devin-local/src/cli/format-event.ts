import pc from "picocolors";

export function printDevinLocalStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  if (!debug) {
    console.log(line);
    return;
  }

  if (line.startsWith("[paperclip]")) {
    console.log(pc.blue(line));
    return;
  }

  console.log(pc.gray(line));
}
