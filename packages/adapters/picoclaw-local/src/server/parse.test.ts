import { describe, expect, it } from "vitest";
import { extractPicoClawSummary, isPicoClawUnknownSessionError } from "./parse.js";

describe("extractPicoClawSummary", () => {
  it("prefers the last assistant-style shrimp line", () => {
    expect(
      extractPicoClawSummary(`
██████╗
🦐 First answer
🦐 Final answer
      `),
    ).toBe("Final answer");
  });

  it("falls back to the last plain line", () => {
    expect(
      extractPicoClawSummary(`
Agent initialized
All done
      `),
    ).toBe("All done");
  });
});

describe("isPicoClawUnknownSessionError", () => {
  it("detects unknown session errors", () => {
    expect(isPicoClawUnknownSessionError("session not found: cli:default", "")).toBe(true);
    expect(isPicoClawUnknownSessionError("", "unknown session id")).toBe(true);
    expect(isPicoClawUnknownSessionError("", "no session available")).toBe(true);
    expect(isPicoClawUnknownSessionError("all good", "")).toBe(false);
    expect(isPicoClawUnknownSessionError("working fine", "no errors")).toBe(false);
  });
});
