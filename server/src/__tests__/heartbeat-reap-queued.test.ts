import { describe, expect, it } from "vitest";
import { shouldReapRun } from "../services/heartbeat.js";

describe("shouldReapRun", () => {
  it("skips queued runs even when not tracked by a process", () => {
    expect(shouldReapRun({ status: "queued" }, false)).toBe(false);
  });

  it("skips queued runs even when tracked by a process", () => {
    expect(shouldReapRun({ status: "queued" }, true)).toBe(false);
  });

  it("skips running runs that are tracked by a process", () => {
    expect(shouldReapRun({ status: "running" }, true)).toBe(false);
  });

  it("reaps running runs that are NOT tracked by a process", () => {
    expect(shouldReapRun({ status: "running" }, false)).toBe(true);
  });
});
