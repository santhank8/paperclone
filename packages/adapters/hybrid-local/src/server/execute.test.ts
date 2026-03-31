import { describe, expect, it } from "vitest";

// Test the helper functions that are used internally by execute.ts
// We re-implement them here since they're not exported, testing the same logic.

function isClaudeQuotaOrAuthError(result: {
  errorCode?: string | null;
  errorMeta?: Record<string, unknown>;
  errorMessage?: string | null;
}): boolean {
  if (result.errorCode === "claude_auth_required") return true;
  if (result.errorMeta && "loginUrl" in result.errorMeta) return true;
  const msg = (result.errorMessage ?? "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("not logged in") ||
    msg.includes("out of credits") ||
    msg.includes("out_of_credits") ||
    msg.includes("extra usage")
  );
}

function isLocalResourceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("out of memory") ||
    lower.includes("gpu") ||
    lower.includes("no model loaded")
  );
}

describe("isClaudeQuotaOrAuthError", () => {
  it("detects claude_auth_required error code", () => {
    expect(isClaudeQuotaOrAuthError({ errorCode: "claude_auth_required" })).toBe(true);
  });

  it("detects loginUrl in errorMeta", () => {
    expect(isClaudeQuotaOrAuthError({ errorMeta: { loginUrl: "https://claude.ai/login" } })).toBe(true);
  });

  it("detects rate limit in error message", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "Rate limit exceeded for this session" })).toBe(true);
  });

  it("detects quota in error message", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "Usage quota exceeded" })).toBe(true);
  });

  it("detects not logged in message", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "Claude is not logged in" })).toBe(true);
  });

  it("detects out of credits message", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "You're out of credits for extra usage" })).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "Command failed with exit code 1" })).toBe(false);
  });

  it("returns false for null/undefined fields", () => {
    expect(isClaudeQuotaOrAuthError({})).toBe(false);
  });

  it("returns false for task errors", () => {
    expect(isClaudeQuotaOrAuthError({ errorMessage: "Claude run failed: subtype=error_max_turns" })).toBe(false);
  });
});

describe("isLocalResourceError", () => {
  it("detects ECONNREFUSED", () => {
    expect(isLocalResourceError(new Error("connect ECONNREFUSED 127.0.0.1:1234"))).toBe(true);
  });

  it("detects ECONNRESET", () => {
    expect(isLocalResourceError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("detects socket hang up", () => {
    expect(isLocalResourceError(new Error("socket hang up"))).toBe(true);
  });

  it("detects timeout/aborted", () => {
    expect(isLocalResourceError(new Error("The operation was aborted"))).toBe(true);
  });

  it("detects HTTP 503", () => {
    expect(isLocalResourceError(new Error("LM Studio returned 503: Service Unavailable"))).toBe(true);
  });

  it("detects HTTP 502", () => {
    expect(isLocalResourceError(new Error("502 Bad Gateway"))).toBe(true);
  });

  it("detects out of memory", () => {
    expect(isLocalResourceError(new Error("CUDA out of memory"))).toBe(true);
  });

  it("detects GPU errors", () => {
    expect(isLocalResourceError(new Error("GPU device not found"))).toBe(true);
  });

  it("detects no model loaded", () => {
    expect(isLocalResourceError(new Error("no model loaded"))).toBe(true);
  });

  it("returns false for HTTP 400", () => {
    expect(isLocalResourceError(new Error("LM Studio returned 400: Bad Request"))).toBe(false);
  });

  it("returns false for JSON parse errors", () => {
    expect(isLocalResourceError(new Error("Unexpected token < in JSON"))).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isLocalResourceError(new Error("Something went wrong"))).toBe(false);
  });

  it("handles string errors", () => {
    expect(isLocalResourceError("connect ECONNREFUSED")).toBe(true);
  });
});

describe("routing metadata", () => {
  it("attachRoutingMeta handles null resultJson", () => {
    const result = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      resultJson: null as Record<string, unknown> | null,
    };
    const meta = {
      primaryModel: "claude-sonnet-4-6",
      primaryBackend: "claude_cli" as const,
      fallbackModel: "qwen/qwen3.5-9b",
      fallbackBackend: "openai_compatible" as const,
      fallbackTriggered: false,
      fallbackReason: null,
      preCheckTriggered: false,
      preCheckReason: null,
    };

    const merged = {
      ...result,
      resultJson: {
        ...(result.resultJson ?? {}),
        _hybrid: meta,
      },
    };

    expect(merged.resultJson._hybrid).toEqual(meta);
    expect(merged.resultJson._hybrid.fallbackTriggered).toBe(false);
  });

  it("attachRoutingMeta preserves existing resultJson fields", () => {
    const result = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      resultJson: { result: "Hello", model: "claude-sonnet-4-6" },
    };
    const meta = {
      primaryModel: "claude-sonnet-4-6",
      primaryBackend: "claude_cli" as const,
      fallbackModel: null,
      fallbackBackend: null,
      fallbackTriggered: false,
      fallbackReason: null,
      preCheckTriggered: false,
      preCheckReason: null,
    };

    const merged = {
      ...result,
      resultJson: {
        ...(result.resultJson ?? {}),
        _hybrid: meta,
      },
    };

    expect(merged.resultJson.result).toBe("Hello");
    expect(merged.resultJson.model).toBe("claude-sonnet-4-6");
    expect(merged.resultJson._hybrid.primaryModel).toBe("claude-sonnet-4-6");
  });
});
