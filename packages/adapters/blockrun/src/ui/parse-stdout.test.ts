import { describe, it, expect } from "vitest";
import { parseBlockRunStdoutLine } from "./parse-stdout.js";

describe("parseBlockRunStdoutLine", () => {
  it("returns empty for blank lines", () => {
    expect(parseBlockRunStdoutLine("", "2026-01-01T00:00:00Z")).toEqual([]);
    expect(parseBlockRunStdoutLine("   ", "2026-01-01T00:00:00Z")).toEqual([]);
  });

  it("parses system messages", () => {
    const entries = parseBlockRunStdoutLine(
      "[blockrun] Model: openai/gpt-4o | Network: mainnet",
      "2026-01-01T00:00:00Z",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("system");
    expect((entries[0] as { text: string }).text).toBe(
      "Model: openai/gpt-4o | Network: mainnet",
    );
  });

  it("parses assistant text events", () => {
    const data = JSON.stringify({ text: "The answer is 42." });
    const entries = parseBlockRunStdoutLine(
      `[blockrun:event] run=test-1 stream=assistant data=${data}`,
      "2026-01-01T00:00:00Z",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("assistant");
    expect((entries[0] as { text: string }).text).toBe("The answer is 42.");
  });

  it("parses assistant delta events", () => {
    const data = JSON.stringify({ delta: "chunk" });
    const entries = parseBlockRunStdoutLine(
      `[blockrun:event] run=test-1 stream=assistant data=${data}`,
      "2026-01-01T00:00:00Z",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("assistant");
    expect((entries[0] as { delta: boolean }).delta).toBe(true);
  });

  it("parses error events", () => {
    const data = JSON.stringify({ error: "Rate limited" });
    const entries = parseBlockRunStdoutLine(
      `[blockrun:event] run=test-1 stream=error data=${data}`,
      "2026-01-01T00:00:00Z",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("stderr");
    expect((entries[0] as { text: string }).text).toBe("Rate limited");
  });

  it("passes through unknown lines as stdout", () => {
    const entries = parseBlockRunStdoutLine(
      "some random output",
      "2026-01-01T00:00:00Z",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("stdout");
  });

  it("handles malformed event JSON gracefully", () => {
    const entries = parseBlockRunStdoutLine(
      "[blockrun:event] run=test-1 stream=assistant data={invalid}",
      "2026-01-01T00:00:00Z",
    );
    // safeJsonParse returns null for invalid JSON, data becomes null,
    // so no assistant text/delta is found → empty result
    expect(entries).toHaveLength(0);
  });
});
