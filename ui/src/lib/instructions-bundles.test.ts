import { describe, expect, it } from "vitest";
import { supportsInstructionsBundles } from "./instructions-bundles";

describe("supportsInstructionsBundles", () => {
  it.each([
    "claude_local",
    "codex_local",
    "gemini_local",
    "opencode_local",
    "pi_local",
    "hermes_local",
    "cursor",
  ])("includes %s in the instructions-bundle adapters", (adapterType) => {
    expect(supportsInstructionsBundles(adapterType)).toBe(true);
  });

  it("rejects non-local adapters", () => {
    expect(supportsInstructionsBundles("http")).toBe(false);
    expect(supportsInstructionsBundles("process")).toBe(false);
  });
});
