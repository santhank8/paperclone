import { describe, expect, it } from "vitest";
import {
  parseClaudeStreamJson,
  detectClaudeLoginRequired,
  describeClaudeFailure,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
  isClaudeContextWindowError,
} from "./parse.js";

describe("parseClaudeStreamJson", () => {
  it("parses assistant text, usage, and cost from stream JSON", () => {
    const stdout = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        session_id: "session_123",
        model: "claude-sonnet-4.6",
      }),
      JSON.stringify({
        type: "assistant",
        session_id: "session_123",
        message: {
          content: [
            { type: "text", text: "Hello from Claude" },
            { type: "text", text: "More text" },
          ],
        },
      }),
      JSON.stringify({
        type: "result",
        session_id: "session_123",
        usage: {
          input_tokens: 1000,
          cache_read_input_tokens: 200,
          output_tokens: 500,
        },
        total_cost_usd: 0.0035,
      }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.sessionId).toBe("session_123");
    expect(parsed.model).toBe("claude-sonnet-4.6");
    expect(parsed.summary).toBe("Hello from Claude\n\nMore text");
    expect(parsed.usage).toEqual({
      inputTokens: 1000,
      cachedInputTokens: 200,
      outputTokens: 500,
    });
    expect(parsed.costUsd).toBeCloseTo(0.0035, 6);
  });

  it("prioritizes result field over assistant texts when present", () => {
    const stdout = [
      JSON.stringify({
        type: "assistant",
        session_id: "session_123",
        message: {
          content: [{ type: "text", text: "Assistant text" }],
        },
      }),
      JSON.stringify({
        type: "result",
        session_id: "session_123",
        result: "Final response",
        usage: {
          input_tokens: 1000,
          cache_read_input_tokens: 0,
          output_tokens: 500,
        },
      }),
    ].join("\n");

    const parsed = parseClaudeStreamJson(stdout);
    expect(parsed.summary).toBe("Final response");
  });

  it("handles empty or malformed output", () => {
    const parsed = parseClaudeStreamJson("not valid json");
    expect(parsed.sessionId).toBeNull();
    expect(parsed.resultJson).toBeNull();
    expect(parsed.usage).toBeNull();
  });
});

describe("detectClaudeLoginRequired", () => {
  it("detects login requirement from error messages", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Please log in to continue" },
      stdout: "",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
  });

  it("extracts login URL from output", () => {
    const result = detectClaudeLoginRequired({
      parsed: null,
      stdout: "Please log in. Visit https://claude.ai/login to authenticate",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(true);
    expect(result.loginUrl).toBe("https://claude.ai/login");
  });

  it("returns false when authenticated", () => {
    const result = detectClaudeLoginRequired({
      parsed: { result: "Hello!" },
      stdout: "Response text",
      stderr: "",
    });
    expect(result.requiresLogin).toBe(false);
    expect(result.loginUrl).toBeNull();
  });
});

describe("isClaudeMaxTurnsResult", () => {
  it("detects max_turns subtype", () => {
    expect(isClaudeMaxTurnsResult({ subtype: "error_max_turns" })).toBe(true);
  });

  it("detects max_turns stop_reason", () => {
    expect(isClaudeMaxTurnsResult({ stop_reason: "max_turns" })).toBe(true);
  });

  it("detects max turns in result text", () => {
    expect(isClaudeMaxTurnsResult({ result: "Reached maximum turns" })).toBe(true);
  });

  it("returns false for normal results", () => {
    expect(isClaudeMaxTurnsResult({ result: "Complete" })).toBe(false);
  });

  it("handles null input", () => {
    expect(isClaudeMaxTurnsResult(null)).toBe(false);
    expect(isClaudeMaxTurnsResult(undefined)).toBe(false);
  });
});

describe("isClaudeUnknownSessionError", () => {
  it("detects session not found errors", () => {
    expect(isClaudeUnknownSessionError({ result: "No conversation found with session id s_123" })).toBe(true);
    expect(isClaudeUnknownSessionError({ result: "Unknown session" })).toBe(true);
    expect(isClaudeUnknownSessionError({ result: "Session abc not found" })).toBe(true);
  });

  it("detects session errors in errors array", () => {
    expect(isClaudeUnknownSessionError({ result: "", errors: ["No conversation found with session id s_123"] })).toBe(true);
    expect(isClaudeUnknownSessionError({ result: "", errors: [{ message: "unknown session" }] })).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isClaudeUnknownSessionError({ result: "Something went wrong" })).toBe(false);
  });

  it("handles null input", () => {
    expect(isClaudeUnknownSessionError(null)).toBe(false);
    expect(isClaudeUnknownSessionError(undefined)).toBe(false);
  });
});

describe("isClaudeContextWindowError", () => {
  it("detects context window limit errors", () => {
    expect(isClaudeContextWindowError({ result: "This conversation has reached its context window limit" })).toBe(true);
    expect(isClaudeContextWindowError({ result: "Error: context.window.limit exceeded" })).toBe(true);
    expect(isClaudeContextWindowError({ result: "context.limit.reached" })).toBe(true);
    expect(isClaudeContextWindowError({ result: "context.length.exceeded maximum" })).toBe(true);
    expect(isClaudeContextWindowError({ result: "token.limit exceeded" })).toBe(true);
    expect(isClaudeContextWindowError({ result: "Maximum context length reached" })).toBe(true);
  });

  it("detects context errors in errors array", () => {
    expect(isClaudeContextWindowError({ result: "", errors: ["reached its context window limit"] })).toBe(true);
    expect(isClaudeContextWindowError({ result: "", errors: [{ error: "context.window.limit" }] })).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isClaudeContextWindowError({ result: "Something went wrong" })).toBe(false);
    expect(isClaudeContextWindowError({ result: "Max turns reached" })).toBe(false);
  });

  it("handles null input", () => {
    expect(isClaudeContextWindowError(null)).toBe(false);
    expect(isClaudeContextWindowError(undefined)).toBe(false);
  });
});

describe("describeClaudeFailure", () => {
  it("describes failure with subtype and detail", () => {
    const result = describeClaudeFailure({
      subtype: "error",
      result: "Something failed",
    });
    expect(result).toBe("Claude run failed: subtype=error: Something failed");
  });

  it("handles missing detail", () => {
    const result = describeClaudeFailure({
      subtype: "error",
      result: "",
    });
    expect(result).toBe("Claude run failed: subtype=error");
  });

  it("uses errors array when result is empty", () => {
    const result = describeClaudeFailure({
      subtype: "error",
      result: "",
      errors: ["Error from API"],
    });
    expect(result).toBe("Claude run failed: subtype=error: Error from API");
  });
});
