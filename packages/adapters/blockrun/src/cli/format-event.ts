import pc from "picocolors";

export function printBlockRunStreamEvent(
  raw: string,
  debug: boolean,
): void {
  // Only strip trailing newlines/carriage returns — preserve leading whitespace for code output
  const line = raw.replace(/[\r\n]+$/, "");
  if (!line) return;

  if (!debug) {
    // In non-debug mode, suppress [blockrun] metadata lines unless they
    // contain error/failure information the user should see.
    if (line.startsWith("[blockrun]")) {
      const lower = line.toLowerCase();
      if (lower.includes("error") || lower.includes("failed")) {
        console.log(line);
      }
      return;
    }
    console.log(line);
    return;
  }

  if (line.startsWith("[blockrun:event]")) {
    console.log(pc.cyan(line));
    return;
  }

  if (line.startsWith("[blockrun]")) {
    console.log(pc.blue(line));
    return;
  }

  console.log(pc.gray(line));
}
