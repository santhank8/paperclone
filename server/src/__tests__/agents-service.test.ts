import { beforeEach, describe, expect, it, vi } from "vitest";
import { agentService } from "../services/agents.ts";

const mockInstanceSettingsService = vi.hoisted(() => ({
  seedDefaultAdapterType: vi.fn(),
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: () => mockInstanceSettingsService,
}));

function buildCreatedAgent(adapterType: string) {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "CEO",
    role: "ceo",
    title: null,
    reportsTo: null,
    capabilities: null,
    adapterType,
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    metadata: null,
    permissions: null,
    status: "idle",
    pauseReason: null,
    pausedAt: null,
    lastHeartbeatAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function createAgentCreateDb(options: {
  existingAgents?: Array<{ id: string; name: string; status: string }>;
  totalAgentCountAfterCreate: number;
  createdAgent: ReturnType<typeof buildCreatedAgent>;
}) {
  let selectCallCount = 0;

  return {
    select: vi.fn(() => {
      selectCallCount += 1;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => Promise.resolve(options.existingAgents ?? []),
          }),
        };
      }
      return {
        from: () => Promise.resolve([{ count: options.totalAgentCountAfterCreate }]),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [options.createdAgent]),
      })),
    })),
  };
}

describe("agent service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstanceSettingsService.seedDefaultAdapterType.mockResolvedValue(undefined);
  });

  it("seeds the instance default adapter after the first agent is created", async () => {
    const createdAgent = buildCreatedAgent("codex_local");
    const dbStub = createAgentCreateDb({
      totalAgentCountAfterCreate: 1,
      createdAgent,
    });

    const svc = agentService(dbStub as any);
    await svc.create("company-1", {
      name: "CEO",
      role: "ceo",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      status: "idle",
      lastHeartbeatAt: null,
    });

    expect(mockInstanceSettingsService.seedDefaultAdapterType).toHaveBeenCalledWith("codex_local");
  });

  it("does not reseed the instance default adapter after later agent creations", async () => {
    const createdAgent = buildCreatedAgent("codex_local");
    const dbStub = createAgentCreateDb({
      existingAgents: [{ id: "agent-existing", name: "Existing", status: "idle" }],
      totalAgentCountAfterCreate: 2,
      createdAgent,
    });

    const svc = agentService(dbStub as any);
    await svc.create("company-1", {
      name: "CEO",
      role: "ceo",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      status: "idle",
      lastHeartbeatAt: null,
    });

    expect(mockInstanceSettingsService.seedDefaultAdapterType).not.toHaveBeenCalled();
  });
});
