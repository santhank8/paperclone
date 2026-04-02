import { describe, expect, it } from "vitest";

// Unit tests for silent heartbeat detection logic.
// These test the conditions that determine silentSuccess and consecutive silent warning thresholds.

// Mirrors the logic in heartbeat.ts finalization:
// isSilentSuccess = outcome === "succeeded" && actionCount === 0
function computeSilentSuccess(outcome: string, actionCount: number): boolean {
  return outcome === "succeeded" && actionCount === 0;
}

// Mirrors the streak computation in dashboard.ts
function computeConsecutiveSilentStreak(flags: boolean[]): number {
  let streak = 0;
  for (const isSilent of flags) {
    if (isSilent) streak++;
    else break;
  }
  return streak;
}

describe("silentSuccess flag", () => {
  it("is true when outcome=succeeded and actionCount=0", () => {
    expect(computeSilentSuccess("succeeded", 0)).toBe(true);
  });

  it("is false when outcome=succeeded but actionCount>0", () => {
    expect(computeSilentSuccess("succeeded", 1)).toBe(false);
    expect(computeSilentSuccess("succeeded", 5)).toBe(false);
  });

  it("is false when outcome is not succeeded", () => {
    expect(computeSilentSuccess("failed", 0)).toBe(false);
    expect(computeSilentSuccess("cancelled", 0)).toBe(false);
    expect(computeSilentSuccess("timed_out", 0)).toBe(false);
  });
});

describe("consecutiveSilentSuccesses streak", () => {
  it("counts full streak when all runs are silent", () => {
    expect(computeConsecutiveSilentStreak([true, true, true])).toBe(3);
  });

  it("stops at first non-silent run", () => {
    expect(computeConsecutiveSilentStreak([true, true, false, true])).toBe(2);
  });

  it("returns 0 when most recent run is not silent", () => {
    expect(computeConsecutiveSilentStreak([false, true, true])).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(computeConsecutiveSilentStreak([])).toBe(0);
  });

  it("triggers warning at threshold of 3", () => {
    const SILENT_THRESHOLD = 3;
    expect(computeConsecutiveSilentStreak([true, true, true]) >= SILENT_THRESHOLD).toBe(true);
    expect(computeConsecutiveSilentStreak([true, true]) >= SILENT_THRESHOLD).toBe(false);
    expect(computeConsecutiveSilentStreak([true, true, false, true]) >= SILENT_THRESHOLD).toBe(false);
  });
});
