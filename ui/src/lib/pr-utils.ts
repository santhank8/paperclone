/**
 * Extracts a human-readable PR number from work product fields.
 * Returns the number as a string, or null if none found.
 */
export function extractPrNumber(wp: {
  externalId: string | null;
  url: string | null;
  title: string;
}): string | null {
  // 1. externalId if numeric
  if (wp.externalId && /^\d+$/.test(wp.externalId)) {
    return wp.externalId;
  }

  // 2. Parse from URL (GitHub /pull/N, GitLab /merge_requests/N)
  if (wp.url) {
    const urlMatch = wp.url.match(/\/(?:pull|merge_requests)\/(\d+)/);
    if (urlMatch) return urlMatch[1];
  }

  // 3. Parse #N from title
  const titleMatch = wp.title.match(/#(\d+)/);
  if (titleMatch) return titleMatch[1];

  return null;
}
