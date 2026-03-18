import { describe, expect, it, vi } from "vitest";
import { execute } from "../adapters/process/execute.js";
import type { AdapterExecutionContext } from "../adapters/types.js";

vi.mock("../adapters/utils.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../adapters/utils.js")>();
  return {
    ...mod,
    runChildProcess: vi.fn().mockResolvedValue({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "",
      stderr: "",
    }),
  };
});

describe("process adapter Paperclip context injection", () => {
  it("sets PAPERCLIP_CONTEXT_JSON and PAPERCLIP_AGENT_JWT on child env", async () => {
    const { runChildProcess } = await import("../adapters/utils.js");
    const ctx: AdapterExecutionContext = {
      runId: "run-uuid-1",
      agent: {
        id: "agent-1",
        companyId: "co-1",
        name: "q",
        adapterType: "process",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        command: "node",
        args: ["-e", "0"],
        cwd: process.cwd(),
        env: {},
      },
      context: { issueId: "iss-9", wakeReason: "manual" },
      onLog: async () => {},
      authToken: "test-jwt-token",
    };
    await execute(ctx);
    expect(runChildProcess).toHaveBeenCalled();
    const call = vi.mocked(runChildProcess).mock.calls[0];
    const opts = call[3] as { env: Record<string, string> };
    expect(opts.env.PAPERCLIP_AGENT_JWT).toBe("test-jwt-token");
    const parsed = JSON.parse(opts.env.PAPERCLIP_CONTEXT_JSON);
    expect(parsed.companyId).toBe("co-1");
    expect(parsed.agentId).toBe("agent-1");
    expect(parsed.heartbeatRunId).toBe("run-uuid-1");
    expect(parsed.issueId).toBe("iss-9");
    expect(parsed.wakeReason).toBe("manual");
  });
});
