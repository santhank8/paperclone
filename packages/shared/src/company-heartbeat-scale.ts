/**
 * Company-wide heartbeat timer scale (0–100 stored on companies).
 * 50 = neutral (1× frequency). Higher = more frequent timer heartbeats; lower = slower.
 * Per-agent `runtimeConfig.heartbeat.intervalSec` stays the baseline; scale applies proportionally.
 */

export const HEARTBEAT_FREQUENCY_SCALE_MIN = 0;
export const HEARTBEAT_FREQUENCY_SCALE_MAX = 100;
export const HEARTBEAT_FREQUENCY_SCALE_DEFAULT = 50;

/** Minimum effective interval (seconds) after scaling (matches V1 scheduler floor). */
export const HEARTBEAT_EFFECTIVE_INTERVAL_MIN_SEC = 30;

/**
 * Frequency multiplier relative to baseline interval.
 * At 50 → 1; at 100 → 4× frequency; at 0 → 0.25× frequency (exponential around center).
 */
export function companyHeartbeatFrequencyMultiplier(scalePercent: number): number {
  const p = clampScalePercent(scalePercent);
  return 4 ** ((p - 50) / 50);
}

export function clampScalePercent(value: number): number {
  if (!Number.isFinite(value)) return HEARTBEAT_FREQUENCY_SCALE_DEFAULT;
  return Math.min(
    HEARTBEAT_FREQUENCY_SCALE_MAX,
    Math.max(HEARTBEAT_FREQUENCY_SCALE_MIN, Math.round(value)),
  );
}

/**
 * Effective timer interval (seconds) for scheduler comparison.
 * Agents with heartbeat disabled or interval 0 should not call this (caller skips).
 */
export function effectiveHeartbeatIntervalSec(
  baseIntervalSec: number,
  companyScalePercent: number,
): number {
  if (baseIntervalSec <= 0) return baseIntervalSec;
  const mult = companyHeartbeatFrequencyMultiplier(companyScalePercent);
  const raw = baseIntervalSec / mult;
  const rounded = Math.max(1, Math.floor(raw));
  return Math.max(HEARTBEAT_EFFECTIVE_INTERVAL_MIN_SEC, rounded);
}
