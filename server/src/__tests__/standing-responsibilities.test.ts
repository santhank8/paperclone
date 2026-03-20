import { describe, expect, it } from "vitest";
import {
  listEnabledAgentResponsibilities,
  normalizeAgentResponsibilities,
} from "../services/agent-responsibilities.js";
import {
  deriveActionCountFromSeq,
  deriveRunDurationMs,
  resolveActiveResponsibilitiesFromContext,
} from "../services/heartbeat.ts";

describe("standing responsibilities", () => {
  it("normalizes responsibility entries and defaults enabled=true", () => {
    const parsed = normalizeAgentResponsibilities([
      { name: "Review inbox", description: "Check urgent updates", enabled: true },
      { name: "Refresh status", description: "Post progress updates" },
      { name: "", description: "invalid missing name", enabled: true },
      { name: "invalid", description: "", enabled: true },
    ]);

    expect(parsed).toEqual([
      { name: "Review inbox", description: "Check urgent updates", enabled: true },
      { name: "Refresh status", description: "Post progress updates", enabled: true },
    ]);
    expect(listEnabledAgentResponsibilities(parsed)).toHaveLength(2);
  });

  it("resolves active responsibilities from context", () => {
    const context = {
      paperclipResponsibilities: [
        { name: "A", description: "Always", enabled: true },
        { name: "B", description: "Disabled", enabled: false },
      ],
    };

    expect(resolveActiveResponsibilitiesFromContext(context)).toEqual([
      { name: "A", description: "Always", enabled: true },
    ]);
  });
});

describe("heartbeat run metrics", () => {
  it("derives run duration and action counts", () => {
    const startedAt = new Date("2026-03-20T00:00:00.000Z");
    const finishedAt = new Date("2026-03-20T00:00:10.250Z");

    expect(deriveRunDurationMs(startedAt, finishedAt)).toBe(10250);
    expect(deriveRunDurationMs(null, finishedAt)).toBeNull();
    expect(deriveActionCountFromSeq(1)).toBe(0);
    expect(deriveActionCountFromSeq(2)).toBe(0);
    expect(deriveActionCountFromSeq(3)).toBe(1);
    expect(deriveActionCountFromSeq(6)).toBe(4);
  });
});
