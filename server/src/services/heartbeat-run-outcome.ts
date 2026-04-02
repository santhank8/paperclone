// Patterns that indicate the agent exited cleanly but could not do any real work.
const SILENT_FAILURE_PATTERNS: RegExp[] = [
  /unable to (?:proceed|continue|complete|execute|perform|accomplish)/i,
  /cannot (?:proceed|continue|complete|execute|perform)/i,
  /couldn'?t (?:proceed|continue|complete|execute|perform)/i,
  /(?:all|every) (?:\w+ ){0,4}(?:blocked|denied|rejected)/i,
  /blocked by permission/i,
  /permissions? (?:block|denied|prevent|restrict)/i,
  /failed to (?:complete|execute|perform) any/i,
  /no (?:actions?|work|progress) (?:were |was )?(?:taken|done|made|completed|performed)/i,
];

// Checks whether adapter output text suggests the agent did no useful work.
export function detectSilentFailure(
  summary: string | null | undefined,
  resultJson: Record<string, unknown> | null | undefined,
): { detected: boolean; matchedPhrase: string | null } {
  const texts: string[] = [];
  if (typeof summary === "string" && summary.trim()) {
    texts.push(summary);
  }
  if (resultJson && typeof resultJson === "object" && !Array.isArray(resultJson)) {
    for (const key of ["result", "summary", "message", "error"] as const) {
      const value = resultJson[key];
      if (typeof value === "string" && value.trim()) {
        texts.push(value);
      }
    }
  }

  const combined = texts.join("\n");
  for (const pattern of SILENT_FAILURE_PATTERNS) {
    const match = combined.match(pattern);
    if (match) return { detected: true, matchedPhrase: match[0] };
  }
  return { detected: false, matchedPhrase: null };
}
