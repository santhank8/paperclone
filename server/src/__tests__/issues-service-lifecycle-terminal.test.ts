import { beforeEach, describe, expect, it, vi } from "vitest";

const applyAutoRetireForIssueMock = vi.fn(async () => [] as string[]);

vi.mock("../services/agents.ts", () => ({
  agentService: () => ({
    applyAutoRetireForIssue: applyAutoRetireForIssueMock,
  }),
}));

import { issueService } from "../services/issues.ts";

function makeDbMock() {
  const selectQueue: unknown[][] = [];
  const updateQueue: unknown[][] = [];

  const select = vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
    };
    return chain;
  });

  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(updateQueue.shift() ?? [])),
      })),
    })),
  }));

  const db: any = {
    select,
    update,
    transaction: vi.fn(async (handler: (tx: any) => Promise<unknown>) => handler(db)),
  };

  return {
    db,
    selectQueue,
    updateQueue,
  };
}

describe("issueService terminal lifecycle hooks", () => {
  beforeEach(() => {
    applyAutoRetireForIssueMock.mockClear();
  });

  it("triggers scoped-agent auto-retire from service-owned terminal transitions", async () => {
    const { db, selectQueue, updateQueue } = makeDbMock();

    selectQueue.push(
      [{
        id: "issue-1",
        companyId: "co-1",
        type: "task",
        status: "active",
        assigneeAgentId: null,
        assigneeUserId: null,
        assignedRoleKey: null,
        parentId: null,
        projectId: null,
        goalId: null,
        contextPacketId: null,
      }],
      [],
    );
    updateQueue.push([
      {
        id: "issue-1",
        companyId: "co-1",
        type: "task",
        status: "cancelled",
        assigneeAgentId: null,
        assigneeUserId: null,
        assignedRoleKey: null,
        parentId: null,
        projectId: null,
        goalId: null,
        contextPacketId: null,
      },
    ]);

    const svc = issueService(db);
    const updated = await svc.update("issue-1", { status: "cancelled" });

    expect(updated?.status).toBe("cancelled");
    expect(applyAutoRetireForIssueMock).toHaveBeenCalledWith("issue-1");
    expect(applyAutoRetireForIssueMock).toHaveBeenCalledTimes(1);
  });
});