import { describe, expect, test } from "vitest";
import {
  computeExecutionLockExpiresAt,
  getExecutionLockTtlMinutes,
  isExecutionLockExpired,
} from "../services/execution-locks.js";

describe("execution lock helpers", () => {
  test("defaults ttl to 15 minutes", () => {
    expect(getExecutionLockTtlMinutes({} as NodeJS.ProcessEnv)).toBe(15);
  });

  test("computes expiry from now + ttl", () => {
    const now = new Date("2026-03-08T00:00:00.000Z");
    const expiresAt = computeExecutionLockExpiresAt(now, 15 * 60 * 1000);
    expect(expiresAt.toISOString()).toBe("2026-03-08T00:15:00.000Z");
  });

  test("detects expired lock timestamps", () => {
    const now = new Date("2026-03-08T00:20:00.000Z");
    expect(isExecutionLockExpired("2026-03-08T00:19:59.000Z", now)).toBe(true);
    expect(isExecutionLockExpired("2026-03-08T00:20:01.000Z", now)).toBe(false);
  });
});
