const BLOCK_MARKER_PATTERNS = [
  /^#{1,6}\s+/m,
  /^>\s+/m,
  /^[-*+]\s+/m,
  /^\d+\.\s+/m,
  /^```/m,
  /^~~~/m,
  /^\|.+\|$/m,
  /^---$/m,
  /^\*\*\*$/m,
  /^___$/m,
];

export function normalizePastedMarkdown(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function looksLikeMarkdownPaste(text: string): boolean {
  const normalized = normalizePastedMarkdown(text).trim();
  if (!normalized) return false;

  if (BLOCK_MARKER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  // Preserve paragraph structure when users paste plain multi-line notes into
  // the markdown editor. Single-line plain text can use the native paste path.
  return normalized.includes("\n");
}
