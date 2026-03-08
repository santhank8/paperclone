import { beforeAll, describe, expect, test } from "vitest";
import { createDb } from "@paperclipai/db";
import { agents, companies, heartbeatRuns, issues } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { issueService } from "../services/issues.js";

function uniqueCode(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

const testDbUrl = process.env.DATABASE_URL || process.env.PAPERCLIP_DATABASE_URL;
const describeWithDb = testDbUrl ? describe : describe.skip;

describeWithDb("execution lock ttl", () => {
  let db: ReturnType<typeof createDb>;

  beforeAll(() => {
    db = createDb(testDbUrl!);
  });

  test("checkout stamps execution lock expiry", async () => {
    const [company] = await db
      .insert(companies)
      .values({ name: "TTL Checkout Co", code: uniqueCode("TTLCHECK") })
      .returning();
    const [agent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        name: "TTL Checkout Agent",
        role: "engineer",
        status: "idle",
        adapterType: "test",
        adapterConfig: {},
      })
      .returning();
    const [run] = await db
      .insert(heartbeatRuns)
      .values({
        companyId: company.id,
        agentId: agent.id,
        status: "running",
        invocationSource: "on_demand",
      })
      .returning();
    const [staleRun] = await db
      .insert(heartbeatRuns)
      .values({
        companyId: company.id,
        agentId: agent.id,
        status: "failed",
        invocationSource: "on_demand",
      })
      .returning();
    const [issue] = await db
      .insert(issues)
      .values({
        companyId: company.id,
        title: "Checkout lock ttl",
        status: "todo",
        priority: "medium",
      })
      .returning();

    const svc = issueService(db);
    const checkedOut = await svc.checkout(issue.id, agent.id, ["todo"], run.id);

    expect(checkedOut.executionRunId).toBe(run.id);
    expect(checkedOut.executionLockExpiresAt).toBeTruthy();
    expect(new Date(checkedOut.executionLockExpiresAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  test("stale checkout adoption refreshes execution lock expiry", async () => {
    const now = new Date();
    const [company] = await db
      .insert(companies)
      .values({ name: "TTL Refresh Co", code: uniqueCode("TTLREF") })
      .returning();
    const [agent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        name: "TTL Refresh Agent",
        role: "engineer",
        status: "idle",
        adapterType: "test",
        adapterConfig: {},
      })
      .returning();
    const [run] = await db
      .insert(heartbeatRuns)
      .values({
        companyId: company.id,
        agentId: agent.id,
        status: "running",
        invocationSource: "on_demand",
      })
      .returning();

    const staleExpiry = new Date(now.getTime() - 60_000);
    const [issue] = await db
      .insert(issues)
      .values({
        companyId: company.id,
        title: "Adopt stale checkout run",
        status: "in_progress",
        priority: "high",
        assigneeAgentId: agent.id,
        checkoutRunId: staleRun.id,
        executionRunId: run.id,
        executionLockedAt: now,
        executionLockExpiresAt: staleExpiry,
      })
      .returning();

    const svc = issueService(db);
    const adopted = await svc.checkout(issue.id, agent.id, ["in_progress"], run.id);
    expect(adopted.executionLockExpiresAt).toBeTruthy();
    expect(new Date(adopted.executionLockExpiresAt as Date).getTime()).toBeGreaterThan(now.getTime());
  });
});
