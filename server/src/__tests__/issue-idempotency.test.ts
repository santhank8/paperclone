import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createDb, applyPendingMigrations, type Db } from "@paperclipai/db";
import { companies, agents, issues } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { issueService as createIssueService } from "../services/issues.js";

let db: Db;
let issueService: ReturnType<typeof createIssueService>;
let companyId: string;
let agentId: string;
let parentIssueId: string;

beforeAll(async () => {
  db = createDb(process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/paperclip_test");
  await applyPendingMigrations(db);

  // Seed a company + agent for testing
  const [company] = await db
    .insert(companies)
    .values({ name: "Idem Test Co", issuePrefix: "IDM", status: "active" })
    .returning();
  companyId = company.id;

  const [agent] = await db
    .insert(agents)
    .values({
      companyId,
      name: "test-cpo",
      adapterType: "claude_local",
      status: "active",
    })
    .returning();
  agentId = agent.id;

  issueService = createIssueService(db);

  // Create a parent issue for sub-issue tests
  const parent = await issueService.create(companyId, {
    title: "Parent dogfooding loop",
    status: "todo",
    assigneeAgentId: agentId,
  });
  parentIssueId = parent.id;
});

afterAll(async () => {
  // Cleanup
  if (db) {
    await db.delete(issues).where(eq(issues.companyId, companyId));
    await db.delete(agents).where(eq(agents.companyId, companyId));
    await db.delete(companies).where(eq(companies.id, companyId));
  }
});

describe("issue idempotency key deduplication", () => {
  it("creates a new issue when no idempotencyKey is provided", async () => {
    const issue = await issueService.create(companyId, {
      title: "No key issue",
      status: "todo",
    });
    expect(issue.id).toBeDefined();
    expect(issue.idempotencyKey).toBeNull();
    expect("_deduplicated" in issue).toBe(false);
  });

  it("creates a new issue with an idempotencyKey", async () => {
    const issue = await issueService.create(companyId, {
      title: "Recurring dogfooding task",
      status: "todo",
      parentId: parentIssueId,
      assigneeAgentId: agentId,
      idempotencyKey: "dogfood-cpo-2026-03-07",
    });
    expect(issue.id).toBeDefined();
    expect(issue.idempotencyKey).toBe("dogfood-cpo-2026-03-07");
    expect("_deduplicated" in issue).toBe(false);
  });

  it("returns existing open issue when same idempotencyKey is used again", async () => {
    const duplicate = await issueService.create(companyId, {
      title: "Recurring dogfooding task (attempt 2)",
      status: "todo",
      parentId: parentIssueId,
      assigneeAgentId: agentId,
      idempotencyKey: "dogfood-cpo-2026-03-07",
    });
    // Should return the original, not create a new one
    expect(duplicate.title).toBe("Recurring dogfooding task");
    expect("_deduplicated" in duplicate && duplicate._deduplicated).toBe(true);
  });

  it("allows new issue after previous one is completed (done)", async () => {
    // Complete the existing issue
    const existing = await db
      .select()
      .from(issues)
      .where(eq(issues.idempotencyKey, "dogfood-cpo-2026-03-07"))
      .then((rows) => rows[0]);
    await issueService.update(existing!.id, { status: "done" });

    // Now creating with same key should produce a new issue
    const newIssue = await issueService.create(companyId, {
      title: "Recurring dogfooding task (next cycle)",
      status: "todo",
      parentId: parentIssueId,
      assigneeAgentId: agentId,
      idempotencyKey: "dogfood-cpo-2026-03-07",
    });
    expect(newIssue.id).not.toBe(existing!.id);
    expect(newIssue.title).toBe("Recurring dogfooding task (next cycle)");
    expect("_deduplicated" in newIssue).toBe(false);
  });

  it("allows new issue after previous one is cancelled", async () => {
    const key = "dogfood-cancel-test";
    const first = await issueService.create(companyId, {
      title: "Will be cancelled",
      status: "todo",
      idempotencyKey: key,
    });

    await issueService.update(first.id, { status: "cancelled" });

    const second = await issueService.create(companyId, {
      title: "Replacement after cancel",
      status: "todo",
      idempotencyKey: key,
    });
    expect(second.id).not.toBe(first.id);
    expect("_deduplicated" in second).toBe(false);
  });

  it("deduplicates across all open statuses (todo, in_progress, blocked)", async () => {
    const key = "dogfood-status-test";

    const original = await issueService.create(companyId, {
      title: "Open task",
      status: "todo",
      assigneeAgentId: agentId,
      idempotencyKey: key,
    });

    // Move to in_progress — should still dedup
    await issueService.update(original.id, { status: "in_progress" });
    const dup1 = await issueService.create(companyId, {
      title: "Should dedup against in_progress",
      status: "todo",
      idempotencyKey: key,
    });
    expect(dup1.id).toBe(original.id);
    expect("_deduplicated" in dup1 && dup1._deduplicated).toBe(true);

    // Move to blocked — should still dedup
    await issueService.update(original.id, { status: "blocked" });
    const dup2 = await issueService.create(companyId, {
      title: "Should dedup against blocked",
      status: "todo",
      idempotencyKey: key,
    });
    expect(dup2.id).toBe(original.id);
    expect("_deduplicated" in dup2 && dup2._deduplicated).toBe(true);
  });

  it("different idempotencyKeys create separate issues", async () => {
    const issue1 = await issueService.create(companyId, {
      title: "Task A",
      status: "todo",
      idempotencyKey: "key-a",
    });
    const issue2 = await issueService.create(companyId, {
      title: "Task B",
      status: "todo",
      idempotencyKey: "key-b",
    });
    expect(issue1.id).not.toBe(issue2.id);
  });
});
