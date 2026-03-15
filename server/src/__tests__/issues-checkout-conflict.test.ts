import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { issueService } from "../services/issues.ts";

function validTaskContextPacketPayload() {
  return {
    source: "context_packet_refresh",
    generatedAt: "2026-03-13T12:00:00.000Z",
    issue: {
      id: "11111111-1111-4111-8111-111111111111",
      identifier: "PAP-9",
      title: "Checkout conflict fixture",
      description: "Valid packet fixture",
      type: "task",
      status: "active",
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

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
    })),
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

describe("issueService checkout conflict", () => {
  it("returns 409 with current owner and status when checkout race loses", async () => {
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
        assigneeAgentId: "agent-9",
        checkoutRunId: "run-99",
        executionRunId: "run-99",
      }],
    );
    updateQueue.push([]);

    const svc = issueService(db);

    await expect(
      svc.checkout("issue-1", "agent-2", ["draft", "active"], "run-1"),
    ).rejects.toMatchObject<HttpError>({
      status: 409,
      message: "Issue checkout conflict",
      details: expect.objectContaining({
        issueId: "issue-1",
        assigneeAgentId: "agent-9",
        status: "active",
      }),
    });
  });
});