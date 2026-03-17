import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentService } from "../services/agents.ts";
import { defaultPermissionsForRole, mergeAgentPermissions, normalizeAgentPermissions } from "../services/agent-permissions.js";

function createAgentUpdateDb(existingRow: Record<string, unknown>) {
  const pendingSelects: unknown[][] = [[existingRow], []];
  let updateSetPayload: Record<string, unknown> | null = null;

  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    groupBy: vi.fn(() => selectChain),
    then: vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(pendingSelects.shift() ?? []))),
  };

  const updateChain = {
    set: vi.fn((payload: Record<string, unknown>) => {
      updateSetPayload = payload;
      return updateChain;
    }),
    where: vi.fn(() => updateChain),
    returning: vi.fn(() => ({
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve([{
        ...existingRow,
        ...updateSetPayload,
      }])),
    })),
  };

  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    },
    getUpdateSetPayload: () => updateSetPayload,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent task-management permissions", () => {
  it("defaults CEOs to task-management access", () => {
    expect(defaultPermissionsForRole("ceo")).toEqual({
      canCreateAgents: true,
      canManageTasks: true,
    });
  });

  it("defaults non-CEOs to no task-management access", () => {
    expect(defaultPermissionsForRole("engineer")).toEqual({
      canCreateAgents: false,
      canManageTasks: false,
    });
  });

  it("preserves explicit permission overrides", () => {
    expect(
      normalizeAgentPermissions(
        { canCreateAgents: false, canManageTasks: true },
        "manager",
      ),
    ).toEqual({
      canCreateAgents: false,
      canManageTasks: true,
    });
  });

  it("preserves existing canManageTasks when omitted from an update patch", () => {
    expect(
      mergeAgentPermissions(
        { canCreateAgents: false, canManageTasks: true },
        { canCreateAgents: true },
        "manager",
      ),
    ).toEqual({
      canCreateAgents: true,
      canManageTasks: true,
    });
  });

  it("preserves canManageTasks when agentService.update receives a partial permissions patch", async () => {
    const dbStub = createAgentUpdateDb({
      id: "agent-1",
      companyId: "company-1",
      name: "Manager",
      role: "manager",
      title: null,
      reportsTo: null,
      capabilities: null,
      adapterType: "claude-local",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 5000,
      spentMonthlyCents: 999999,
      metadata: null,
      permissions: { canCreateAgents: false, canManageTasks: true },
      status: "idle",
      pauseReason: null,
      pausedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const agents = agentService(dbStub.db as any);
    const updated = await agents.update("agent-1", {
      permissions: { canCreateAgents: true },
    } as any);

    expect(dbStub.getUpdateSetPayload()).toEqual(expect.objectContaining({
      permissions: { canCreateAgents: true, canManageTasks: true },
    }));
    expect(updated?.permissions).toEqual({
      canCreateAgents: true,
      canManageTasks: true,
    });
  });
});
