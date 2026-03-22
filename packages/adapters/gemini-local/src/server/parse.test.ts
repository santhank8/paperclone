import { describe, expect, it } from "vitest";
import { parseGeminiJsonl, isGeminiUnknownSessionError } from "./parse.js";

describe("parseGeminiJsonl", () => {
  it("parses type:assistant messages", () => {
    const stdout = [
      JSON.stringify({
        type: "assistant",
        session_id: "abc-123",
        message: { text: "Hello from Gemini" },
      }),
    ].join("\n");

    const result = parseGeminiJsonl(stdout);
    expect(result.sessionId).toBe("abc-123");
    expect(result.summary).toBe("Hello from Gemini");
  });

  it("parses type:message with role:assistant (Gemini CLI v0.33+)", () => {
    const stdout = [
      JSON.stringify({
        type: "message",
        role: "assistant",
        session_id: "session-v33",
        content: "hello",
      }),
    ].join("\n");

    const result = parseGeminiJsonl(stdout);
    expect(result.sessionId).toBe("session-v33");
    expect(result.summary).toBe("hello");
  });

  it("ignores type:message without role:assistant", () => {
    const stdout = [
      JSON.stringify({
        type: "message",
        role: "user",
        content: "user input",
      }),
    ].join("\n");

    const result = parseGeminiJsonl(stdout);
    expect(result.summary).toBe("");
  });

  it("parses result events with usage", () => {
    const stdout = [
      JSON.stringify({
        type: "result",
        result: "Done.",
        usage: { input_tokens: 100, output_tokens: 50 },
        total_cost_usd: 0.005,
      }),
    ].join("\n");

    const result = parseGeminiJsonl(stdout);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.costUsd).toBe(0.005);
  });

  it("captures error messages", () => {
    const stdout = [
      JSON.stringify({
        type: "error",
        error: "Model not found",
      }),
    ].join("\n");

    const result = parseGeminiJsonl(stdout);
    expect(result.errorMessage).toBe("Model not found");
  });

  it("handles empty stdout", () => {
    const result = parseGeminiJsonl("");
    expect(result.sessionId).toBeNull();
    expect(result.summary).toBe("");
    expect(result.errorMessage).toBeNull();
  });
});

describe("isGeminiUnknownSessionError", () => {
  it("detects unknown session errors", () => {
    expect(isGeminiUnknownSessionError("unknown session abc-123", "")).toBe(true);
    expect(isGeminiUnknownSessionError("", "cannot resume session")).toBe(true);
    expect(isGeminiUnknownSessionError("failed to resume session", "")).toBe(true);
    expect(isGeminiUnknownSessionError("session xyz not found", "")).toBe(true);
    expect(isGeminiUnknownSessionError("resume id not found", "")).toBe(true);
    // Actual error from Gemini CLI when resuming stale session
    expect(isGeminiUnknownSessionError("", "Error resuming session: No previous sessions found for this project.")).toBe(true);
  });

  it("returns false for non-session errors", () => {
    expect(isGeminiUnknownSessionError("Model not found", "")).toBe(false);
    expect(isGeminiUnknownSessionError("", "API key invalid")).toBe(false);
  });
});
