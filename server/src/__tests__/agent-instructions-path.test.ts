import { describe, expect, it } from "vitest";
import { defaultInstructionsFilePathForNewAgent, defaultInstructionsPathKeyForAdapter } from "../routes/agents.js";

describe("defaultInstructionsPathKeyForAdapter", () => {
  it("maps local instruction-file adapters to instructionsFilePath", () => {
    expect(defaultInstructionsPathKeyForAdapter("claude_local")).toBe("instructionsFilePath");
    expect(defaultInstructionsPathKeyForAdapter("codex_local")).toBe("instructionsFilePath");
    expect(defaultInstructionsPathKeyForAdapter("gemini_local")).toBe("instructionsFilePath");
    expect(defaultInstructionsPathKeyForAdapter("opencode_local")).toBe("instructionsFilePath");
    expect(defaultInstructionsPathKeyForAdapter("pi_local")).toBe("instructionsFilePath");
    expect(defaultInstructionsPathKeyForAdapter("cursor")).toBe("instructionsFilePath");
  });

  it("returns null when an adapter has no default instructions key", () => {
    expect(defaultInstructionsPathKeyForAdapter("process")).toBeNull();
  });
});

describe("defaultInstructionsFilePathForNewAgent", () => {
  it("points supported local adapters at the agent-home AGENTS.md file", () => {
    expect(defaultInstructionsFilePathForNewAgent("claude_local", "agent-123")).toMatch(
      /workspaces[\\/]+agent-123[\\/]AGENTS\.md$/,
    );
    expect(defaultInstructionsFilePathForNewAgent("codex_local", "agent-123")).toMatch(
      /workspaces[\\/]+agent-123[\\/]AGENTS\.md$/,
    );
  });

  it("returns null for adapters without instructions-file support", () => {
    expect(defaultInstructionsFilePathForNewAgent("process", "agent-123")).toBeNull();
  });
});
