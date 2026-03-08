const DEFAULT_EXECUTION_LOCK_TTL_MINUTES = 15;
const MIN_EXECUTION_LOCK_TTL_MINUTES = 1;

export function getExecutionLockTtlMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.HEARTBEAT_EXECUTION_LOCK_TTL_MINUTES;
  const parsed = Number(raw ?? DEFAULT_EXECUTION_LOCK_TTL_MINUTES);
  if (!Number.isFinite(parsed)) return DEFAULT_EXECUTION_LOCK_TTL_MINUTES;
  return Math.max(MIN_EXECUTION_LOCK_TTL_MINUTES, Math.floor(parsed));
}

export function getExecutionLockTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  return getExecutionLockTtlMinutes(env) * 60 * 1000;
}

export function computeExecutionLockExpiresAt(now: Date, ttlMs: number = getExecutionLockTtlMs()): Date {
  return new Date(now.getTime() + ttlMs);
}

export function isExecutionLockExpired(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (!Number.isFinite(expiresAtDate.getTime())) return false;
  return expiresAtDate.getTime() <= now.getTime();
}
