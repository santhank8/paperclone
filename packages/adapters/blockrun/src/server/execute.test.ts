import { describe, it, expect, vi, beforeEach } from "vitest";
import { execute } from "./execute.js";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeContext(
  overrides: Partial<{
    config: Record<string, unknown>;
    context: Record<string, unknown>;
  }> = {},
): AdapterExecutionContext {
  const logs: string[] = [];
  return {
    runId: "test-run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      adapterType: "blockrun",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      model: "nvidia/gpt-oss-120b",
      network: "testnet",
      ...overrides.config,
    },
    context: {
      wakeText: "Hello, what is 2+2?",
      ...overrides.context,
    },
    onLog: vi.fn(async (_stream: string, chunk: string) => {
      logs.push(chunk);
    }),
    onMeta: vi.fn(),
  };
}

describe("blockrun adapter execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no prompt provided", async () => {
    const ctx = makeContext({
      context: { wakeText: "", prompt: "", issueBody: "" },
    });
    const result = await execute(ctx);
    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("NO_PROMPT");
  });

  it("handles free model (200 response directly)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "resp-1",
        object: "chat.completion",
        model: "nvidia/gpt-oss-120b",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "The answer is 4." },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          total_tokens: 23,
        },
      }),
    });

    const ctx = makeContext();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 8 });
    expect(result.provider).toBe("nvidia");
    expect(result.model).toBe("nvidia/gpt-oss-120b");
    expect(result.billingType).toBe("api");
    expect(result.summary).toContain("The answer is 4.");

    // Verify fetch was called with correct URL and body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://testnet.blockrun.ai/api/v1/chat/completions");
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("nvidia/gpt-oss-120b");
    expect(body.messages.length).toBeGreaterThan(0);
  });

  it("returns PAYMENT_REQUIRED when 402 and no private key", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      headers: new Headers({
        "Payment-Required": Buffer.from(
          JSON.stringify([
            {
              scheme: "exact",
              network: "eip155:84532",
              maxAmountRequired: "15000",
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              maxTimeoutSeconds: 300,
            },
          ]),
        ).toString("base64"),
      }),
    });

    const ctx = makeContext({
      config: { model: "openai/gpt-4o", network: "testnet" },
    });
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("PAYMENT_REQUIRED");
    expect(result.errorMessage).toContain("private key");
  });

  it("handles API error gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => '{"error":"Internal Server Error"}',
    });

    const ctx = makeContext();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("API_ERROR");
    expect(result.errorMessage).toContain("500");
  });

  it("handles timeout errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("TimeoutError: signal timed out"));

    const ctx = makeContext();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(true);
    expect(result.errorCode).toBe("TIMEOUT");
  });

  it("uses routing mode when no model specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        model: "openai/gpt-4o",
        choices: [
          {
            message: { role: "assistant", content: "Hi" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const ctx = makeContext({
      config: { model: "", routingMode: "balanced", network: "mainnet" },
    });
    const result = await execute(ctx);

    expect(result.exitCode).toBe(0);
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("openai/gpt-4o"); // balanced → gpt-4o
  });

  it("builds messages from Paperclip context fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        model: "nvidia/gpt-oss-120b",
        choices: [
          {
            message: { role: "assistant", content: "Done" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 3, total_tokens: 53 },
      }),
    });

    const ctx = makeContext({
      context: {
        companyName: "Acme Corp",
        companyMission: "Build great software",
        agentTitle: "Lead Developer",
        issueTitle: "Fix auth bug",
        wakeText: "Please investigate the login failure",
      },
    });

    const result = await execute(ctx);
    expect(result.exitCode).toBe(0);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);

    // Should have system message with context and user message with wakeText
    const systemMsg = body.messages.find(
      (m: { role: string; content: string }) =>
        m.role === "system" && m.content.includes("Acme Corp"),
    );
    expect(systemMsg).toBeDefined();
    expect(systemMsg.content).toContain("Lead Developer");

    const userMsg = body.messages.find(
      (m: { role: string; content: string }) =>
        m.role === "user" && m.content.includes("login failure"),
    );
    expect(userMsg).toBeDefined();
  });

  it("logs transcript events correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        model: "nvidia/gpt-oss-120b",
        choices: [
          {
            message: { role: "assistant", content: "Result text" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const ctx = makeContext();
    await execute(ctx);

    const onLog = ctx.onLog as ReturnType<typeof vi.fn>;
    const logCalls = onLog.mock.calls.map(
      (args: unknown[]) => ({ stream: args[0] as string, chunk: args[1] as string }),
    );

    // Should log model info
    expect(logCalls.some((l) => l.chunk.includes("Model:"))).toBe(true);

    // Should log [blockrun:event] with assistant response
    expect(
      logCalls.some((l) => l.chunk.includes("[blockrun:event]")),
    ).toBe(true);

    // Should log completion stats
    expect(
      logCalls.some((l) => l.chunk.includes("Completed")),
    ).toBe(true);
  });
});
