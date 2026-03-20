import { describe, expect, it, vi } from "vitest";
import {
  buildIssueLifecycleWebhookPayload,
  deliverIssueLifecycleWebhook,
  isIssueLifecycleTerminalTransition,
  resolveLifecycleWakeAgentIds,
} from "../routes/issues-lifecycle-notifications.js";

describe("issue lifecycle notifications", () => {
  it("detects terminal lifecycle transitions", () => {
    expect(isIssueLifecycleTerminalTransition("todo", "done")).toBe(true);
    expect(isIssueLifecycleTerminalTransition("in_progress", "blocked")).toBe(true);
    expect(isIssueLifecycleTerminalTransition("done", "done")).toBe(false);
    expect(isIssueLifecycleTerminalTransition("todo", "in_progress")).toBe(false);
  });

  it("resolves lifecycle wake targets with dedupe and actor self-skip", () => {
    expect(
      resolveLifecycleWakeAgentIds({
        issue: {
          createdByAgentId: "agent-1",
          assignedByAgentId: "agent-2",
        },
        company: {
          notifyIssueCreator: true,
          notifyIssueAssigner: true,
        },
        actor: {
          actorType: "agent",
          actorId: "agent-1",
          agentId: "agent-1",
        },
      }),
    ).toEqual(["agent-2"]);
  });

  it("builds webhook payload with transition, actor, and summary", () => {
    const payload = buildIssueLifecycleWebhookPayload({
      issue: {
        id: "issue-1",
        companyId: "company-1",
        identifier: "PAP-10",
        title: "Ship lifecycle hooks",
        priority: "high",
        status: "done",
        assigneeAgentId: "agent-3",
        assigneeUserId: null,
        createdByAgentId: "agent-1",
        createdByUserId: null,
        assignedByAgentId: "agent-2",
        assignedByUserId: null,
      },
      previousStatus: "in_progress",
      actor: {
        actorType: "user",
        actorId: "user-1",
        agentId: null,
      },
      summary: "  Finalized and merged.  ",
      occurredAt: new Date("2026-03-20T01:00:00.000Z"),
    });

    expect(payload).toEqual({
      event: "issue.lifecycle_transition",
      occurredAt: "2026-03-20T01:00:00.000Z",
      companyId: "company-1",
      issue: {
        id: "issue-1",
        identifier: "PAP-10",
        title: "Ship lifecycle hooks",
        priority: "high",
        status: "done",
        assigneeAgentId: "agent-3",
        assigneeUserId: null,
        createdByAgentId: "agent-1",
        createdByUserId: null,
        assignedByAgentId: "agent-2",
        assignedByUserId: null,
      },
      transition: {
        from: "in_progress",
        to: "done",
      },
      actor: {
        type: "user",
        id: "user-1",
        agentId: null,
        userId: "user-1",
      },
      summary: "Finalized and merged.",
    });
  });

  it("returns not-attempted when webhook URL is missing", async () => {
    const result = await deliverIssueLifecycleWebhook(null, {
      event: "issue.lifecycle_transition",
      occurredAt: "2026-03-20T01:00:00.000Z",
      companyId: "company-1",
      issue: {
        id: "issue-1",
        identifier: "PAP-10",
        title: "Ship lifecycle hooks",
        priority: "high",
        status: "done",
        assigneeAgentId: "agent-3",
        assigneeUserId: null,
        createdByAgentId: "agent-1",
        createdByUserId: null,
        assignedByAgentId: "agent-2",
        assignedByUserId: null,
      },
      transition: {
        from: "in_progress",
        to: "done",
      },
      actor: {
        type: "agent",
        id: "agent-3",
        agentId: "agent-3",
        userId: null,
      },
      summary: null,
    });
    expect(result).toEqual({
      attempted: false,
      delivered: false,
      status: null,
      error: null,
    });
  });

  it("posts webhook payload and reports response status", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 204 }));
    const payload = {
      event: "issue.lifecycle_transition" as const,
      occurredAt: "2026-03-20T01:00:00.000Z",
      companyId: "company-1",
      issue: {
        id: "issue-1",
        identifier: "PAP-10",
        title: "Ship lifecycle hooks",
        priority: "high",
        status: "done",
        assigneeAgentId: "agent-3",
        assigneeUserId: null,
        createdByAgentId: "agent-1",
        createdByUserId: null,
        assignedByAgentId: "agent-2",
        assignedByUserId: null,
      },
      transition: {
        from: "in_progress",
        to: "done",
      },
      actor: {
        type: "agent" as const,
        id: "agent-3",
        agentId: "agent-3",
        userId: null,
      },
      summary: "done",
    };

    const result = await deliverIssueLifecycleWebhook("https://example.com/hooks/issues", payload, { fetchImpl });

    expect(result).toEqual({
      attempted: true,
      delivered: true,
      status: 204,
      error: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://example.com/hooks/issues");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(payload));
  });
});
