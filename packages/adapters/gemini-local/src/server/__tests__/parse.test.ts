import { describe, expect, it } from "vitest";
import { parseGeminiStreamJson, parseGeminiJson, isGeminiSessionNotFoundError } from "../parse.js";

describe("parseGeminiStreamJson", () => {
  it("extracts session ID from init event", () => {
    const stdout = JSON.stringify({ type: "init", session_id: "s_abc123", model: "gemini-2.5-pro" });
    const result = parseGeminiStreamJson(stdout);
    expect(result.sessionId).toBe("s_abc123");
  });

  it("collects assistant messages", () => {
    const stdout = [
      JSON.stringify({ type: "message", role: "assistant", content: "Hello" }),
      JSON.stringify({ type: "message", role: "assistant", content: "World" }),
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.summary).toBe("Hello\n\nWorld");
  });

  it("filters non-assistant messages", () => {
    const stdout = [
      JSON.stringify({ type: "message", role: "user", content: "ignored" }),
      JSON.stringify({ type: "message", role: "assistant", content: "kept" }),
      JSON.stringify({ type: "message", role: "system", content: "ignored" }),
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.summary).toBe("kept");
  });

  it("extracts error from error event using message field", () => {
    const stdout = JSON.stringify({ type: "error", message: "rate limit exceeded" });
    const result = parseGeminiStreamJson(stdout);
    expect(result.errorMessage).toBe("rate limit exceeded");
  });

  it("extracts error from error event using error field as fallback", () => {
    const stdout = JSON.stringify({ type: "error", error: "connection failed" });
    const result = parseGeminiStreamJson(stdout);
    expect(result.errorMessage).toBe("connection failed");
  });

  it("extracts error from result event with non-success status (string error)", () => {
    const stdout = JSON.stringify({ type: "result", status: "error", error: "model unavailable" });
    const result = parseGeminiStreamJson(stdout);
    expect(result.errorMessage).toBe("model unavailable");
  });

  it("extracts error from result event with non-success status (object error)", () => {
    const stdout = JSON.stringify({
      type: "result",
      status: "error",
      error: { type: "Error", message: "quota exceeded" },
    });
    const result = parseGeminiStreamJson(stdout);
    expect(result.errorMessage).toBe("quota exceeded");
  });

  it("does not set error on result event with success status", () => {
    const stdout = JSON.stringify({
      type: "result",
      status: "success",
      stats: { input_tokens: 10, output_tokens: 5, cached: 2 },
    });
    const result = parseGeminiStreamJson(stdout);
    expect(result.errorMessage).toBeNull();
  });

  it("extracts usage stats from result event", () => {
    const stdout = JSON.stringify({
      type: "result",
      status: "success",
      stats: { input_tokens: 100, output_tokens: 50, cached: 20 },
    });
    const result = parseGeminiStreamJson(stdout);
    expect(result.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 50,
    });
  });

  it("falls back to stats.input when input_tokens is missing", () => {
    const stdout = JSON.stringify({
      type: "result",
      status: "success",
      stats: { input: 80, output_tokens: 30, cached: 5 },
    });
    const result = parseGeminiStreamJson(stdout);
    expect(result.usage.inputTokens).toBe(80);
  });

  it("returns zero usage on empty input", () => {
    const result = parseGeminiStreamJson("");
    expect(result.sessionId).toBeNull();
    expect(result.summary).toBe("");
    expect(result.usage).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
    expect(result.errorMessage).toBeNull();
  });

  it("skips blank lines", () => {
    const stdout = [
      "",
      JSON.stringify({ type: "message", role: "assistant", content: "hello" }),
      "   ",
      "",
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.summary).toBe("hello");
  });

  it("skips malformed JSON lines", () => {
    const stdout = [
      "not json at all",
      JSON.stringify({ type: "message", role: "assistant", content: "valid" }),
      "{broken",
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.summary).toBe("valid");
  });

  it("ignores unknown event types", () => {
    const stdout = [
      JSON.stringify({ type: "unknown_event", data: "something" }),
      JSON.stringify({ type: "message", role: "assistant", content: "real" }),
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.summary).toBe("real");
  });

  it("handles full lifecycle: init → messages → result", () => {
    const stdout = [
      JSON.stringify({ type: "init", session_id: "s_lifecycle" }),
      JSON.stringify({ type: "message", role: "assistant", content: "Working on it..." }),
      JSON.stringify({ type: "message", role: "assistant", content: "Done!" }),
      JSON.stringify({
        type: "result",
        status: "success",
        stats: { input_tokens: 200, output_tokens: 80, cached: 50 },
      }),
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.sessionId).toBe("s_lifecycle");
    expect(result.summary).toBe("Working on it...\n\nDone!");
    expect(result.usage).toEqual({ inputTokens: 200, cachedInputTokens: 50, outputTokens: 80 });
    expect(result.errorMessage).toBeNull();
  });

  it("handles lifecycle with error", () => {
    const stdout = [
      JSON.stringify({ type: "init", session_id: "s_err" }),
      JSON.stringify({ type: "message", role: "assistant", content: "Starting..." }),
      JSON.stringify({ type: "error", message: "something went wrong" }),
      JSON.stringify({ type: "result", status: "error", error: "fatal" }),
    ].join("\n");
    const result = parseGeminiStreamJson(stdout);
    expect(result.sessionId).toBe("s_err");
    expect(result.summary).toBe("Starting...");
    expect(result.errorMessage).toBe("fatal");
  });
});

describe("parseGeminiJson", () => {
  it("parses valid JSON with session, response, and stats", () => {
    const stdout = JSON.stringify({
      session_id: "s_json1",
      response: "Hello from Gemini",
      stats: {
        models: {
          "gemini-2.5-pro": { tokens: { input: 100, candidates: 50, cached: 10 } },
        },
      },
    });
    const result = parseGeminiJson(stdout);
    expect(result.sessionId).toBe("s_json1");
    expect(result.summary).toBe("Hello from Gemini");
    expect(result.usage).toEqual({ inputTokens: 100, cachedInputTokens: 10, outputTokens: 50 });
    expect(result.errorMessage).toBeNull();
  });

  it("accumulates tokens across multiple models", () => {
    const stdout = JSON.stringify({
      session_id: "s_multi",
      response: "Multi-model response",
      stats: {
        models: {
          "gemini-2.5-pro": { tokens: { input: 100, candidates: 50, cached: 10 } },
          "gemini-2.5-flash": { tokens: { input: 30, candidates: 20, cached: 5 } },
        },
      },
    });
    const result = parseGeminiJson(stdout);
    expect(result.usage.inputTokens).toBe(130);
    expect(result.usage.outputTokens).toBe(70);
    expect(result.usage.cachedInputTokens).toBe(15);
  });

  it("falls back to raw stdout for non-JSON input", () => {
    const result = parseGeminiJson("plain text output");
    expect(result.sessionId).toBeNull();
    expect(result.summary).toBe("plain text output");
    expect(result.usage).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  });

  it("handles missing stats gracefully", () => {
    const stdout = JSON.stringify({ session_id: "s_nostats", response: "No stats" });
    const result = parseGeminiJson(stdout);
    expect(result.sessionId).toBe("s_nostats");
    expect(result.summary).toBe("No stats");
    expect(result.usage).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  });
});

describe("isGeminiSessionNotFoundError", () => {
  it("matches 'session ... not found'", () => {
    expect(isGeminiSessionNotFoundError("session s_abc123 not found", "")).toBe(true);
  });

  it("matches 'invalid session'", () => {
    expect(isGeminiSessionNotFoundError("", "invalid session")).toBe(true);
  });

  it("matches 'no such session'", () => {
    expect(isGeminiSessionNotFoundError("no such session available", "")).toBe(true);
  });

  it("matches 'cannot resume'", () => {
    expect(isGeminiSessionNotFoundError("", "cannot resume session")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isGeminiSessionNotFoundError("SESSION S_123 NOT FOUND", "")).toBe(true);
    expect(isGeminiSessionNotFoundError("", "Invalid Session")).toBe(true);
    expect(isGeminiSessionNotFoundError("CANNOT RESUME", "")).toBe(true);
  });

  it("does not false-positive on unrelated output", () => {
    expect(isGeminiSessionNotFoundError("all good", "no errors here")).toBe(false);
    expect(isGeminiSessionNotFoundError("session started successfully", "")).toBe(false);
    expect(isGeminiSessionNotFoundError("", "")).toBe(false);
  });
});
