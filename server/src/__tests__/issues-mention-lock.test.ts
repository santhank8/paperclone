import { describe, expect, it, vi } from "vitest";
import { issueService } from "../services/issues.ts";

function validTaskContextPacketPayload() {
  return {
    source: "context_packet_refresh",
    generatedAt: "2026-03-13T12:00:00.000Z",
    issue: {
      id: "11111111-1111-4111-8111-111111111111",
      identifier: "PAP-1",
      title: "Workflow hardening task",
      description: "Valid packet fixture",
      type: "task",
      status: "draft",
      priority: "medium",
      projectId: null,
      goalId: null,
      parentId: null,
      assignedRoleKey: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    },
    ancestors: [],
    project: null,
    goal: null,
    registryPolicy: null,
  };
}

function makeDbMock() {
  const selectQueue: unknown[][] = [];
  const updateQueue: unknown[][] = [];

  const fromMock = vi.fn(() => ({
    where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
    innerJoin: vi.fn(() => {
      const afterWhere = { orderBy: vi.fn(() => Promise.resolve([])) };
      return {
        where: vi.fn(() => afterWhere),
      };
    }),
  }));

  const select = vi.fn(() => ({
    from: fromMock,
  }));

  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(updateQueue.shift() ?? [])),
      })),
    })),
  }));

  return {
    db: {
      select,
      update,
    } as any,
    selectQueue,
    updateQueue,
  };
}

describe("issueService mention-lock checkout behavior", () => {
  it("allows checkout when issue is in todo status and no execution lock", async () => {
    const { db, selectQueue, updateQueue } = makeDbMock();

    selectQueue.push(
      [{ id: "issue-1", companyId: "co-1", type: "task", status: "draft", contextPacketId: "pkt-1" }],
      [{
        id: "pkt-1",
        companyId: "co-1",
        issueId: "issue-1",
        tier: "worker_task",
        schemaVersion: 1,
        payload: validTaskContextPacketPayload(),
        parentContextPacketId: null,
        validationStatus: "valid",
        createdByAgentId: null,
        createdByUserId: null,
        createdAt: new Date("2026-03-13T12:00:00.000Z"),
        updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      }],
      [{ id: "agent-1", companyId: "co-1", status: "idle", roleKey: "worker_task" }],
      [{
        id: "issue-1",
        status: "draft",
        assigneeAgentId: null,
        checkoutRunId: null,
        executionRunId: null,
      }],
    );
    updateQueue.push([{
      id: "issue-1",
      status: "active",
      assigneeAgentId: "agent-1",
      checkoutRunId: "run-1",
      executionRunId: "run-1",
    }]);

    const svc = issueService(db);
    const result = await svc.checkout("issue-1", "agent-1", ["draft", "draft"], "run-1");

    expect(result).toBeDefined();
    expect(result.status).toBe("active");
    expect(result.assigneeAgentId).toBe("agent-1");
  });

  it("blocks checkout when another agent has execution lock (different run)", async () => {
    const { db, selectQueue, updateQueue } = makeDbMock();

    selectQueue.push(
      [{ id: "issue-1", companyId: "co-1", type: "task", status: "active", contextPacketId: "pkt-1" }],
      [{
        id: "pkt-1",
        companyId: "co-1",
        issueId: "issue-1",
        tier: "worker_task",
        schemaVersion: 1,
        payload: validTaskContextPacketPayload(),
        parentContextPacketId: null,
        validationStatus: "valid",
        createdByAgentId: null,
        createdByUserId: null,
        createdAt: new Date("2026-03-13T12:00:00.000Z"),
        updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      }],
      [{ id: "agent-2", companyId: "co-1", status: "idle", roleKey: "worker_task" }],
      [{
        id: "issue-1",
        status: "active",
        assigneeAgentId: "agent-1",
        checkoutRunId: "run-1",
        executionRunId: "run-1",
      }],
    );
    updateQueue.push([]);

    const svc = issueService(db);

    await expect(
      svc.checkout("issue-1", "agent-2", ["draft", "draft", "active"], "run-2"),
    ).rejects.toMatchObject({
      message: "Issue checkout conflict",
      status: 409,
    });
  });

  it("allows checkout adoption when same agent tries to checkout with new run id", async () => {
    const { db, selectQueue, updateQueue } = makeDbMock();

    selectQueue.push(
      [{ id: "issue-1", companyId: "co-1", type: "task", status: "active", contextPacketId: "pkt-1" }],
      [{
        id: "pkt-1",
        companyId: "co-1",
        issueId: "issue-1",
        tier: "worker_task",
        schemaVersion: 1,
        payload: validTaskContextPacketPayload(),
        parentContextPacketId: null,
        validationStatus: "valid",
        createdByAgentId: null,
        createdByUserId: null,
        createdAt: new Date("2026-03-13T12:00:00.000Z"),
        updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      }],
      [{ id: "agent-1", companyId: "co-1", status: "idle", roleKey: "worker_task" }],
      [{
        id: "issue-1",
        status: "active",
        assigneeAgentId: "agent-1",
        checkoutRunId: "run-stale",
        executionRunId: "run-stale",
      }],
    );
    updateQueue.push([{
      id: "issue-1",
      status: "active",
      assigneeAgentId: "agent-1",
      checkoutRunId: "run-new",
      executionRunId: "run-new",
    }]);

    const svc = issueService(db);
    const result = await svc.checkout("agent-1", "agent-1", ["draft", "active"], "run-new");

    expect(result).toBeDefined();
    expect(result.checkoutRunId).toBe("run-new");
  });

  it("finds mentioned agents from comment body", async () => {
    const { db, selectQueue } = makeDbMock();

    selectQueue.push(
      [{ id: "agent-1", name: "alice" }],
    );

    const svc = issueService(db as any);
    const mentioned = await svc.findMentionedAgents("co-1", "Hey @alice can you look at this?");

    expect(mentioned).toContain("agent-1");
  });

  it("returns empty array when no mentions in comment body", async () => {
    const { db } = makeDbMock();

    const svc = issueService(db as any);
    const mentioned = await svc.findMentionedAgents("co-1", "This is a regular comment without mentions");

    expect(mentioned).toEqual([]);
  });

  it("handles multiple mentions in comment body", async () => {
    const { db, selectQueue } = makeDbMock();

    selectQueue.push(
      [
        { id: "agent-1", name: "alice" },
        { id: "agent-2", name: "bob" },
      ],
    );

    const svc = issueService(db as any);
    const mentioned = await svc.findMentionedAgents("co-1", "Hey @alice and @bob, please review this!");

    expect(mentioned).toContain("agent-1");
    expect(mentioned).toContain("agent-2");
  });

  it("is case-insensitive for agent mentions", async () => {
    const { db, selectQueue } = makeDbMock();

    selectQueue.push(
      [{ id: "agent-1", name: "Alice" }],
    );

    const svc = issueService(db as any);
    const mentioned = await svc.findMentionedAgents("co-1", "Hey @ALICE can you help?");

    expect(mentioned).toContain("agent-1");
  });
});