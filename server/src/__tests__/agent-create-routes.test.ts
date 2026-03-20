import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { agentRoutes } from "../routes/agents.js";

const mockAgentService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  getChainOfCommand: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  getBudgetSummary: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockWorkspaceOperationService = vi.hoisted(() => ({
  listForAgent: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  budgetService: () => mockBudgetService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

function createDbStub(company = { id: "company-1", requireBoardApprovalForNewAgents: false }) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([company]),
      }),
    }),
  };
}

function createApp(db = createDbStub()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", agentRoutes(db as any));
  app.use(errorHandler);
  return app;
}

describe("agent create routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessService.canUser.mockResolvedValue(true);
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockSecretService.normalizeAdapterConfigForPersistence.mockImplementation(
      async (_companyId: string, adapterConfig: Record<string, unknown>) => adapterConfig,
    );
    mockSecretService.resolveAdapterConfigForRuntime.mockImplementation(
      async (_companyId: string, adapterConfig: Record<string, unknown>) => ({ config: adapterConfig }),
    );
    mockLogActivity.mockResolvedValue(undefined);
    mockAgentService.getById.mockResolvedValue(null);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.create.mockImplementation(
      async (companyId: string, data: Record<string, unknown>) => ({
        id: data.id,
        companyId,
        name: data.name,
        role: data.role ?? "general",
        status: data.status ?? "idle",
        adapterType: data.adapterType ?? "process",
        adapterConfig: data.adapterConfig ?? {},
        runtimeConfig: data.runtimeConfig ?? {},
        permissions: data.permissions ?? null,
        reportsTo: data.reportsTo ?? null,
        title: data.title ?? null,
        icon: data.icon ?? null,
        capabilities: data.capabilities ?? null,
        budgetMonthlyCents: data.budgetMonthlyCents ?? 0,
        spentMonthlyCents: data.spentMonthlyCents ?? 0,
        lastHeartbeatAt: data.lastHeartbeatAt ?? null,
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      }),
    );
  });

  it("defaults supported local agents to their agent-home AGENTS.md path", async () => {
    const res = await request(createApp())
      .post("/api/companies/company-1/agents")
      .send({
        name: "Founding Engineer",
        adapterType: "codex_local",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.adapterConfig.instructionsFilePath).toMatch(
      new RegExp(`workspaces[\\\\/]+${res.body.id}[\\\\/]AGENTS\\.md$`),
    );
  });

  it("preserves an explicit instructions path on direct agent creation", async () => {
    const res = await request(createApp())
      .post("/api/companies/company-1/agents")
      .send({
        name: "CEO",
        adapterType: "codex_local",
        adapterConfig: {
          instructionsFilePath: "/tmp/custom/AGENTS.md",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.adapterConfig.instructionsFilePath).toBe("/tmp/custom/AGENTS.md");
  });

  it("defaults hires to the same agent-home AGENTS.md path", async () => {
    const res = await request(createApp())
      .post("/api/companies/company-1/agent-hires")
      .send({
        name: "Founding Engineer",
        adapterType: "claude_local",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(res.body.agent.id).toEqual(expect.any(String));
    expect(res.body.agent.adapterConfig.instructionsFilePath).toMatch(
      new RegExp(`workspaces[\\\\/]+${res.body.agent.id}[\\\\/]AGENTS\\.md$`),
    );
    expect(res.body.approval).toBeNull();
  });
});
