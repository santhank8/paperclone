import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  createDb,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { issueService } from "../services/issues.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping stale execution lock recovery tests: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("stale execution lock recovery", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof issueService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  const companyId = randomUUID();
  const agentId = randomUUID();

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-stale-exec-lock-");
    db = createDb(tempDb.connectionString);
    svc = issueService(db);

    await db.insert(companies).values({
      id: companyId,
      name: "TestCorp",
      issuePrefix: "TST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "TestAgent",
      role: "engineer",
      status: "active",
      adapterType: "claude_local",
      adapterConfig: {},
    });
  }, 20_000);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(heartbeatRuns);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function createIssue(overrides: Partial<typeof issues.$inferInsert> = {}) {
    const [issue] = await db
      .insert(issues)
      .values({
        companyId,
        title: "Test issue",
        status: "todo",
        issueNumber: Math.floor(Math.random() * 100000),
        identifier: `TST-${Math.floor(Math.random() * 100000)}`,
        ...overrides,
      })
      .returning();
    return issue;
  }

  async function createRun(status: string, overrides: Partial<typeof heartbeatRuns.$inferInsert> = {}) {
    const [run] = await db
      .insert(heartbeatRuns)
      .values({
        companyId,
        agentId,
        status,
        invocationSource: "heartbeat",
        ...overrides,
      })
      .returning();
    return run;
  }

  describe("assertCheckoutOwner: null checkoutRunId + stale executionRunId", () => {
    it("adopts the lock when executionRunId references a terminal (failed) run", async () => {
      const deadRun = await createRun("failed");
      const newRunId = randomUUID();

      const issue = await createIssue({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: deadRun.id,
        executionLockedAt: new Date(Date.now() - 60_000),
      });

      const result = await svc.assertCheckoutOwner(issue.id, agentId, newRunId);
      expect(result.adoptedFromRunId).toBe(deadRun.id);
      expect(result.checkoutRunId).toBe(newRunId);
    });

    it("adopts the lock when executionRunId references a missing (deleted) run", async () => {
      const missingRunId = randomUUID();
      const newRunId = randomUUID();

      const issue = await createIssue({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: missingRunId,
        executionLockedAt: new Date(Date.now() - 60_000),
      });

      const result = await svc.assertCheckoutOwner(issue.id, agentId, newRunId);
      expect(result.adoptedFromRunId).toBe(missingRunId);
      expect(result.checkoutRunId).toBe(newRunId);
    });

    it("rejects when executionRunId references a still-running run", async () => {
      const liveRun = await createRun("running", {
        startedAt: new Date(),
      });
      const newRunId = randomUUID();

      const issue = await createIssue({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: liveRun.id,
        executionLockedAt: new Date(),
      });

      await expect(svc.assertCheckoutOwner(issue.id, agentId, newRunId)).rejects.toThrow(
        "Issue run ownership conflict",
      );
    });
  });

  describe("checkout: in_progress + null checkoutRunId + stale executionRunId", () => {
    it("recovers stale execution lock and adopts on checkout", async () => {
      const deadRun = await createRun("cancelled");
      const newRunId = randomUUID();

      const issue = await createIssue({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: deadRun.id,
        executionLockedAt: new Date(Date.now() - 60_000),
      });

      // Checkout with expectedStatuses that do NOT include in_progress —
      // but the issue is already in_progress. The recovery path should handle it.
      const result = await svc.checkout(issue.id, agentId, ["todo", "backlog", "blocked"], newRunId);
      expect(result.checkoutRunId).toBe(newRunId);
      expect(result.executionRunId).toBe(newRunId);
      expect(result.status).toBe("in_progress");
    });

    it("does not recover when execution run is still active", async () => {
      const liveRun = await createRun("running", {
        startedAt: new Date(),
      });
      const newRunId = randomUUID();

      const issue = await createIssue({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutRunId: null,
        executionRunId: liveRun.id,
        executionLockedAt: new Date(),
      });

      await expect(
        svc.checkout(issue.id, agentId, ["todo", "backlog", "blocked"], newRunId),
      ).rejects.toThrow("Issue checkout conflict");
    });
  });
});
