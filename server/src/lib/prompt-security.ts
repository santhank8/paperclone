/**
 * Prompt injection defense utilities.
 *
 * User-controlled content (issue titles, descriptions, comments) must be
 * sanitized before inclusion in LLM prompts. This module provides a single
 * sanitizeForPrompt() function that:
 *   1. Strips known injection patterns
 *   2. Truncates to a caller-specified max length
 *   3. Wraps the result in <user_content> delimiters so the model can
 *      distinguish system instructions from user-supplied text
 */

/** Patterns that match secrets and credentials that must not leave the instance. */
const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys (e.g. OpenAI sk-..., Anthropic sk-ant-..., generic sk-... keys)
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: "[REDACTED]" },
  // PEM private keys
  { pattern: /-----BEGIN[\w\s]+PRIVATE KEY-----[\s\S]*?-----END[\w\s]+PRIVATE KEY-----/g, replacement: "[REDACTED]" },
  // Postgres/database connection strings — redact the password portion only
  { pattern: /(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/g, replacement: "$1[REDACTED]$2" },
];

/**
 * Redact secrets from a string before sending it to an external LLM API.
 * Strips API keys, private keys, and database connection string passwords.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Patterns that are commonly used to hijack LLM instruction context. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous\s+instructions?/gi,
  /ignore\s+all\s+instructions?/gi,
  /system\s*:/gi,
  /###/g,
  /you\s+are\s+now/gi,
  /forget\s+(your\s+)?instructions?/gi,
  /new\s+instructions?\s*:/gi,
  /ADMIN\s+OVERRIDE/gi,
];

/** Default max lengths (characters) for each context type. */
export const PROMPT_MAX_LENGTHS = {
  taskContext: 8000,
  comment: 2000,
} as const;

/**
 * Sanitize a user-controlled string before embedding it in an LLM prompt.
 *
 * @param raw       The raw user-controlled string.
 * @param maxLength Maximum characters to keep (excess is truncated with a notice).
 * @returns         The sanitized string wrapped in <user_content> delimiters.
 */
export function sanitizeForPrompt(raw: string, maxLength: number): string {
  if (!raw) return "";

  // 1. Strip injection patterns
  let sanitized = raw;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }

  // 2. Truncate
  let truncated = false;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    truncated = true;
  }

  // 3. Wrap in clear delimiters
  const suffix = truncated ? "\n[content truncated]" : "";
  return `<user_content>\n${sanitized}${suffix}\n</user_content>`;
}
