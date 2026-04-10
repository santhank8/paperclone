import { describe, expect, it } from "vitest";
import { firstNonEmptyLine } from "./utils.js";

describe("firstNonEmptyLine", () => {
  it("returns the first non-empty line", () => {
    expect(firstNonEmptyLine("\n\nhello\nworld")).toBe("hello");
  });

  it("returns empty string for all-empty input", () => {
    expect(firstNonEmptyLine("\n\n  \n")).toBe("");
  });

  it("skips the YOLO mode banner and returns the real error", () => {
    const stderr = [
      "YOLO mode is enabled. All tool calls will be automatically approved.",
      "YOLO mode is enabled. All tool calls will be automatically approved.",
      "Failed to fetch admin controls: request to https://cloudcode-pa.googleapis.com/v1internal:fetchAdminControls failed, reason: read ETIMEDOUT",
      "An unexpected critical error occurred: ETIMEDOUT",
    ].join("\n");
    // Both benign patterns are skipped, so we get the "An unexpected..." line.
    expect(firstNonEmptyLine(stderr)).toBe("An unexpected critical error occurred: ETIMEDOUT");
  });

  it("skips cloudcode-pa admin-controls noise", () => {
    const stderr = [
      "Failed to fetch admin controls: cloudcode-pa.googleapis.com read ETIMEDOUT",
      "Quota exceeded for model gemini-3.1-pro-preview",
    ].join("\n");
    expect(firstNonEmptyLine(stderr)).toBe("Quota exceeded for model gemini-3.1-pro-preview");
  });

  it("returns empty string when only benign lines are present", () => {
    const stderr = "YOLO mode is enabled. All tool calls will be automatically approved.";
    expect(firstNonEmptyLine(stderr)).toBe("");
  });
});
