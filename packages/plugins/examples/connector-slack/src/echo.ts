/**
 * Echo prevention — tracks recent changes we caused so we don't
 * re-sync them back to Slack when the plugin event fires.
 *
 * Flow:
 *   1. Slack webhook arrives → we call ctx.issues.update()
 *   2. That fires an issue.updated plugin event
 *   3. Our outbound handler checks isEcho() → returns true → skips posting to Slack
 */

const TTL_MS = 60_000;

const recentOwnChanges = new Map<string, number>();

/** Mark an entity as recently changed by us (inbound from Slack). */
export function markAsOwnChange(entityId: string): void {
  recentOwnChanges.set(entityId, Date.now());
}

/** Check if an entity was recently changed by us and should be skipped. */
export function isOwnChange(entityId: string): boolean {
  const ts = recentOwnChanges.get(entityId);
  if (ts === undefined) return false;
  if (Date.now() - ts > TTL_MS) {
    recentOwnChanges.delete(entityId);
    return false;
  }
  return true;
}

/** Periodic cleanup of expired entries. */
export function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, ts] of recentOwnChanges) {
    if (now - ts > TTL_MS) {
      recentOwnChanges.delete(key);
    }
  }
}

/** Clear all tracked changes (for testing). */
export function clearAll(): void {
  recentOwnChanges.clear();
}
