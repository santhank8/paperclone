import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveBaseUrl, executeLocalModel } from "./openai-compat.js";

describe("resolveBaseUrl", () => {
  it("returns the default URL when config is undefined", () => {
    expect(resolveBaseUrl(undefined)).toBe("http://127.0.0.1:11434/v1");
  });

  it("returns the default URL when config is empty string", () => {
    expect(resolveBaseUrl("")).toBe("http://127.0.0.1:11434/v1");
  });

  it("returns the default URL when config is whitespace", () => {
    expect(resolveBaseUrl("   ")).toBe("http://127.0.0.1:11434/v1");
  });

  it("returns the default URL when config is null", () => {
    expect(resolveBaseUrl(null)).toBe("http://127.0.0.1:11434/v1");
  });

  it("returns the default URL when config is a number", () => {
    expect(resolveBaseUrl(42)).toBe("http://127.0.0.1:11434/v1");
  });

  it("uses the configured URL when provided", () => {
    expect(resolveBaseUrl("http://192.168.1.100:1234/v1")).toBe("http://192.168.1.100:1234/v1");
  });

  it("trims whitespace from configured URL", () => {
    expect(resolveBaseUrl("  http://localhost:1234/v1  ")).toBe("http://localhost:1234/v1");
  });

  it("strips trailing slashes from configured URL", () => {
    expect(resolveBaseUrl("http://localhost:1234/v1/")).toBe("http://localhost:1234/v1");
  });

  it("strips multiple trailing slashes", () => {
    expect(resolveBaseUrl("http://localhost:1234/v1///")).toBe("http://localhost:1234/v1");
  });
});

describe("executeLocalModel — systemPrompt injection", () => {
  const noopLog = vi.fn().mockResolvedValue(undefined);
  const baseOpts = {
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5-coder:7b",
    prompt: "Fix the bug",
    cwd: "/repo",
    enableTools: false,
    timeoutMs: 5_000,
    onLog: noopLog,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends only user message when no systemPrompt provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen2.5-coder:7b",
        choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    await executeLocalModel(baseOpts);

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
  });

  it("prepends system message when systemPrompt is provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen2.5-coder:7b",
        choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
      }),
    });

    await executeLocalModel({ ...baseOpts, systemPrompt: "You are a PlotSpark engineer." });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toBe("You are a PlotSpark engineer.");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("Fix the bug");
  });

  it("system message appears before user message in tool-use mode", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen2.5-coder:7b",
        choices: [{ message: { role: "assistant", content: "done", tool_calls: [] }, finish_reason: "stop" }],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
      }),
    });

    await executeLocalModel({ ...baseOpts, systemPrompt: "Arch context here.", enableTools: true });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });
});
