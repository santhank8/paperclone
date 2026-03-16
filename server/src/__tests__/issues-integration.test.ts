import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { activityLog, records, issues as issuesTable } from "@paperclipai/db";
import { createIntegrationHarness } from "../test-support/integration-harness.js";

async function waitForCondition<T>(label: string, fn: () => Promise<T | null>, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

describe.sequential("issue workflow integration", () => {
  let harness: Awaited<ReturnType<typeof createIntegrationHarness>> | null = null;
  const primaryRunId = "11111111-1111-4111-8111-111111111111";
  const competingRunId = "22222222-2222-4222-8222-222222222222";

  beforeAll(async () => {
    harness = await createIntegrationHarness();
  });

  afterAll(async () => {
    await harness?.cleanup();
  });

  it("covers create, checkout conflict, review handoff, and activity auditing", async () => {
    if (!harness) {
      throw new Error("Integration harness not initialized");
    }
    const company = await harness.createCompany({ name: "Blue Labs" });
    const goal = await harness.createGoal(company.id as string, {
      title: "Ship V1",
      level: "company",
      status: "active",
    });
    const project = await harness.createProject(company.id as string, {
      name: "Review Pipeline",
      goalIds: [goal.id],
      status: "in_progress",
    });
    const labelResponse = await harness.board
      .post(`/companies/${company.id as string}/labels`)
      .send({ name: "governance", color: "#112233" });
    expect(labelResponse.status).toBe(201);

    const assignee = await harness.createAgent(company.id as string, {
      name: "Builder Bot",
      role: "engineer",
    });
    const competingAgent = await harness.createAgent(company.id as string, {
      name: "Verifier Bot",
      role: "engineer",
    });
    const assigneeKey = await harness.createAgentKey(assignee.id as string);
    const competingKey = await harness.createAgentKey(competingAgent.id as string);
    await harness.createHeartbeatRun(company.id as string, assignee.id as string, {
      id: primaryRunId,
      contextSnapshot: {
        source: "issues-integration",
        issuePhase: "checkout",
      },
    });

    const createdIssue = await harness.createIssue(company.id as string, {
      title: "Cover review handoffs",
      description: "Exercise issue lifecycle coverage.",
      status: "backlog",
      projectId: project.id,
      goalId: goal.id,
      assigneeAgentId: assignee.id,
      labelIds: [labelResponse.body.id],
    });

    expect(createdIssue.projectId).toBe(project.id);
    expect(createdIssue.goalId).toBe(goal.id);
    expect(createdIssue.assigneeAgentId).toBe(assignee.id);
    expect(createdIssue.status).toBe("backlog");

    const checkedOut = await harness.asAgent(assigneeKey.token as string, primaryRunId)
      .post(`/issues/${createdIssue.id as string}/checkout`)
      .send({
        agentId: assignee.id,
        expectedStatuses: ["backlog", "todo"],
      });
    expect(checkedOut.status).toBe(200);
    expect(checkedOut.body.status).toBe("in_progress");
    expect(checkedOut.body.checkoutRunId).toBe(primaryRunId);

    const checkoutConflict = await harness.asAgent(competingKey.token as string, competingRunId)
      .post(`/issues/${createdIssue.id as string}/checkout`)
      .send({
        agentId: competingAgent.id,
        expectedStatuses: ["todo", "in_progress"],
      });
    expect(checkoutConflict.status).toBe(409);
    expect(checkoutConflict.body.error).toContain("conflict");

    const handoff = await harness.asAgent(assigneeKey.token as string, primaryRunId)
      .patch(`/issues/${createdIssue.id as string}`)
      .send({
        status: "done",
        comment: "Ready for board review.",
      });
    expect(handoff.status).toBe(200);
    expect(handoff.body.status).toBe("in_review");
    expect(handoff.body.assigneeAgentId).toBeNull();
    expect(handoff.body.assigneeUserId).toBe("local-board");
    expect(handoff.body.comment.body).toContain("Ready for board review.");

    const handoffBriefing = await waitForCondition("handoff briefing", async () => {
      return harness.db
        .select()
        .from(records)
        .where(
          and(
            eq(records.companyId, company.id as string),
            eq(records.scopeRefId, project.id as string),
            eq(records.category, "briefing"),
          ),
        )
        .then((rows) => rows[0] ?? null);
    });
    expect(handoffBriefing.kind).toBe("daily_briefing");
    expect(handoffBriefing.status).toBe("published");

    const lifecycleActions = await harness.db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.companyId, company.id as string), eq(activityLog.entityId, createdIssue.id as string)))
      .orderBy(desc(activityLog.createdAt));

    expect(lifecycleActions.map((row) => row.action)).toEqual(
      expect.arrayContaining(["issue.created", "issue.checked_out", "issue.updated", "issue.comment_added"]),
    );
  });

  it("records terminal timestamps and reopens closed issues from comments", async () => {
    if (!harness) {
      throw new Error("Integration harness not initialized");
    }
    const company = await harness.createCompany({ name: "Reopen Labs" });
    const issue = await harness.createIssue(company.id as string, {
      title: "Exercise reopen flow",
      status: "todo",
    });

    const cancelled = await harness.board.patch(`/issues/${issue.id as string}`).send({
      status: "cancelled",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.cancelledAt).toBeTruthy();

    const reopenedComment = await harness.board.post(`/issues/${issue.id as string}/comments`).send({
      body: "Re-opening this issue for follow-up.",
      reopen: true,
    });
    expect(reopenedComment.status).toBe(201);

    const reopenedIssue = await harness.db
      .select()
      .from(issuesTable)
      .where(eq(issuesTable.id, issue.id as string))
      .then((rows) => rows[0]!);

    expect(reopenedIssue.status).toBe("todo");

    const reopenActivity = await harness.db
      .select()
      .from(activityLog)
      .where(
        and(
          eq(activityLog.companyId, company.id as string),
          eq(activityLog.entityId, issue.id as string),
          eq(activityLog.action, "issue.comment_added"),
        ),
      )
      .orderBy(desc(activityLog.createdAt))
      .then((rows) => rows[0]!);

    expect(reopenActivity.details).toMatchObject({
      reopened: true,
      reopenedFrom: "cancelled",
    });
  });
});
