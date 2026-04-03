import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  agentWakeupRequests,
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
import { heartbeatService } from "../services/heartbeat.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping heartbeat wakeup telemetry tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("heartbeat wakeup telemetry", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-heartbeat-wakeup-telemetry-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedAgent(input?: { withIssue?: boolean }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();
    const issueId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: "running",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: "running",
      contextSnapshot: input?.withIssue
        ? { issueId, taskKey: issueId }
        : { taskKey: "task-1" },
      startedAt: new Date("2026-03-20T12:00:00.000Z"),
    });

    if (input?.withIssue) {
      await db.insert(issues).values({
        id: issueId,
        companyId,
        title: "Execution issue",
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: agentId,
        executionRunId: runId,
        executionAgentNameKey: "codexcoder",
        issueNumber: 1,
        identifier: `${issuePrefix}-1`,
      });
    }

    return { companyId, agentId, runId, issueId };
  }

  it("records coalesced telemetry even when non-issue wake context adds no delta", async () => {
    const { companyId, agentId, runId } = await seedAgent();
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.wakeup(agentId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      contextSnapshot: { taskKey: "task-1" },
    });

    expect(result?.id).toBe(runId);

    const wakeups = await db
      .select()
      .from(agentWakeupRequests)
      .where(and(eq(agentWakeupRequests.companyId, companyId), eq(agentWakeupRequests.agentId, agentId)));

    expect(wakeups).toHaveLength(1);
    expect(wakeups[0]?.status).toBe("coalesced");
    expect(wakeups[0]?.runId).toBe(runId);
  });

  it("records coalesced telemetry even when issue execution wake adds no delta", async () => {
    const { companyId, agentId, runId, issueId } = await seedAgent({ withIssue: true });
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.wakeup(agentId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId },
      contextSnapshot: { issueId, taskKey: issueId },
    });

    expect(result?.id).toBe(runId);

    const wakeups = await db
      .select()
      .from(agentWakeupRequests)
      .where(and(eq(agentWakeupRequests.companyId, companyId), eq(agentWakeupRequests.agentId, agentId)));

    expect(wakeups).toHaveLength(1);
    expect(wakeups[0]?.status).toBe("coalesced");
    expect(wakeups[0]?.runId).toBe(runId);
  });
});
