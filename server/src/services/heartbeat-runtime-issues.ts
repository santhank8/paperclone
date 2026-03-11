const HEARTBEAT_RUNTIME_ISSUE_PATTERNS = [
  /Project workspace path ".*" is not available yet/i,
  /Saved session workspace ".*" is not available/i,
  /Failed to authenticate\. API Error: 401 .*Invalid bearer token/i,
  /I need shell access to run the Paperclip heartbeat/i,
  /bash commands are being blocked/i,
  /This command requires approval/i,
  /Bash command contains multiple operations\..*require[s]? approval/i,
  /Board access required/i,
] as const;

export function hasHeartbeatRuntimeIssue(input: {
  status: string;
  error?: string | null;
  stderrExcerpt?: string | null;
  resultJson?: Record<string, unknown> | null;
}) {
  const resultText =
    input.resultJson && typeof input.resultJson.result === "string" ? input.resultJson.result : null;
  const haystacks = [input.error, input.stderrExcerpt, resultText].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (haystacks.length === 0) return false;
  if (input.status === "cancelled" || input.status === "skipped") return false;
  return haystacks.some((value) =>
    HEARTBEAT_RUNTIME_ISSUE_PATTERNS.some((pattern) => pattern.test(value)),
  );
}

export function hasHeartbeatOperatorAttentionRequest(input: {
  status: string;
  resultJson?: Record<string, unknown> | null;
}) {
  if (input.status === "cancelled" || input.status === "skipped") return false;
  const resultText =
    input.resultJson && typeof input.resultJson.result === "string" ? input.resultJson.result : null;
  if (!resultText) return false;

  const asksForHumanInput =
    /\bI need\b/i.test(resultText) &&
    (/\bconfirmation\b/i.test(resultText) ||
      /\bconfirmations\b/i.test(resultText) ||
      /\bplease confirm\b/i.test(resultText) ||
      /\bplease provide\b/i.test(resultText) ||
      /\?\s*$/m.test(resultText) ||
      /^\d+\.\s/m.test(resultText));

  return asksForHumanInput;
}
