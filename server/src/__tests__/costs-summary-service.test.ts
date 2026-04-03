import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, agents, companies, costEvents } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { costService } from "../services/costs.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping costs summary service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("costService.summary", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-cost-summary-service-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(costEvents);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("counts token-using zero-cost non-subscription events as unknown cost", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const now = new Date("2026-04-03T10:00:00.000Z");

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
      budgetMonthlyCents: 1000,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Cost Agent",
      role: "engineer",
      status: "running",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(costEvents).values([
      {
        id: randomUUID(),
        companyId,
        agentId,
        provider: "openai",
        biller: "openai",
        billingType: "unknown",
        model: "gpt-5.4",
        inputTokens: 100,
        cachedInputTokens: 20,
        outputTokens: 5,
        costCents: 0,
        occurredAt: now,
      },
      {
        id: randomUUID(),
        companyId,
        agentId,
        provider: "openai",
        biller: "chatgpt",
        billingType: "subscription_included",
        model: "gpt-5.4",
        inputTokens: 50,
        cachedInputTokens: 10,
        outputTokens: 5,
        costCents: 0,
        occurredAt: now,
      },
      {
        id: randomUUID(),
        companyId,
        agentId,
        provider: "anthropic",
        biller: "anthropic",
        billingType: "metered_api",
        model: "claude-opus-4-6",
        inputTokens: 10,
        cachedInputTokens: 0,
        outputTokens: 5,
        costCents: 25,
        occurredAt: now,
      },
    ]);

    const summary = await costService(db).summary(companyId);

    expect(summary.spendCents).toBe(25);
    expect(summary.unknownCostEventCount).toBe(1);
    expect(summary.unknownCostTokenCount).toBe(125);
  });
});
