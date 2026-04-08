import { describe, expect, it } from "vitest";
import {
  clampScalePercent,
  companyHeartbeatFrequencyMultiplier,
  effectiveHeartbeatIntervalSec,
  HEARTBEAT_EFFECTIVE_INTERVAL_MIN_SEC,
  HEARTBEAT_FREQUENCY_SCALE_DEFAULT,
} from "@paperclipai/shared";

describe("companyHeartbeatFrequencyMultiplier", () => {
  it("is 1 at default scale", () => {
    expect(companyHeartbeatFrequencyMultiplier(50)).toBe(1);
  });

  it("increases frequency toward 100", () => {
    expect(companyHeartbeatFrequencyMultiplier(100)).toBe(4);
  });

  it("decreases frequency toward 0", () => {
    expect(companyHeartbeatFrequencyMultiplier(0)).toBeCloseTo(0.25);
  });
});

describe("effectiveHeartbeatIntervalSec", () => {
  it("uses baseline at default scale when above min floor", () => {
    expect(effectiveHeartbeatIntervalSec(120, HEARTBEAT_FREQUENCY_SCALE_DEFAULT)).toBe(120);
  });

  it("respects minimum effective interval", () => {
    expect(effectiveHeartbeatIntervalSec(60, 100)).toBe(HEARTBEAT_EFFECTIVE_INTERVAL_MIN_SEC);
  });

  it("returns 0 for non-positive baseline", () => {
    expect(effectiveHeartbeatIntervalSec(0, 50)).toBe(0);
    expect(effectiveHeartbeatIntervalSec(-1, 50)).toBe(-1);
  });
});

describe("clampScalePercent", () => {
  it("clamps to 0–100", () => {
    expect(clampScalePercent(-5)).toBe(0);
    expect(clampScalePercent(200)).toBe(100);
    expect(clampScalePercent(49.4)).toBe(49);
  });
});
