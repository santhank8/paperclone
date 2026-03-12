/**
 * Live E2E test against the real BlockRun API.
 * Uses free model (nvidia/gpt-oss-120b) — no wallet needed.
 *
 * Run with: pnpm vitest run src/server/e2e.test.ts
 * Skip in CI by checking BLOCKRUN_E2E env var.
 */
import { describe, it, expect } from "vitest";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { listModels } from "./index.js";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const SKIP_E2E = !process.env.BLOCKRUN_E2E;

describe.skipIf(SKIP_E2E)("blockrun adapter E2E (live API)", () => {
  it(
    "lists models from live API",
    async () => {
      const models = await listModels();
      expect(models.length).toBeGreaterThan(0);
      // Should include at least one free model
      const freeModel = models.find((m) => m.id.startsWith("nvidia/"));
      expect(freeModel).toBeDefined();
      console.log(`  Found ${models.length} models, including: ${freeModel!.id}`);
    },
    15_000,
  );

  it(
    "testEnvironment passes with free model config",
    async () => {
      const result = await testEnvironment({
        companyId: "test-company",
        adapterType: "blockrun",
        config: {
          model: "nvidia/gpt-oss-120b",
          network: "mainnet",
        },
      });
      expect(result.status).not.toBe("fail");
      expect(result.checks.some((c) => c.code === "blockrun_api_reachable")).toBe(true);
      console.log(
        "  Checks:",
        result.checks.map((c) => `${c.level}: ${c.message}`).join("\n    "),
      );
    },
    15_000,
  );

  it(
    "executes a chat completion with free model",
    async () => {
      const logs: Array<{ stream: string; chunk: string }> = [];
      const ctx: AdapterExecutionContext = {
        runId: "e2e-test-run",
        agent: {
          id: "e2e-agent",
          companyId: "e2e-company",
          name: "E2E Test Agent",
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
          network: "mainnet",
          maxTokens: 100,
          temperature: 0,
          timeoutSec: 30,
        },
        context: {
          wakeText: "What is 2+2? Answer with just the number.",
        },
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        },
        onMeta: async () => {},
      };

      const result = await execute(ctx);

      console.log("  Exit code:", result.exitCode);
      console.log("  Model:", result.model);
      console.log("  Provider:", result.provider);
      console.log("  Usage:", result.usage);
      console.log("  Summary:", result.summary?.slice(0, 200));
      console.log("  Logs:", logs.length, "entries");

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.model).toContain("nvidia");
      expect(result.provider).toBe("nvidia");
      expect(result.usage).toBeDefined();
      expect(result.usage!.inputTokens).toBeGreaterThan(0);
      expect(result.usage!.outputTokens).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary!.length).toBeGreaterThan(0);

      // Check that transcript logs were generated
      const systemLogs = logs.filter((l) => l.chunk.includes("[blockrun]"));
      expect(systemLogs.length).toBeGreaterThan(0);
      const eventLogs = logs.filter((l) => l.chunk.includes("[blockrun:event]"));
      expect(eventLogs.length).toBeGreaterThan(0);
    },
    30_000,
  );
});
