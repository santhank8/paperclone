import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  getByIdentifier: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  reportRunActivity: vi.fn(async () => undefined),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockQueueIssueAssignmentWakeup = vi.hoisted(() => vi.fn());
const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/issue-assignment-wakeup.js", () => ({
  queueIssueAssignmentWakeup: mockQueueIssueAssignmentWakeup,
}));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

function makeExistingIssue() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    status: "todo",
    assigneeAgentId: "22222222-2222-4222-8222-222222222222",
    assigneeUserId: null,
    createdByUserId: "local-board",
    identifier: "CMP-166",
    title: "라벨 강제 및 done 게이트 1차 구현",
  };
}

function makeCreatedIssue() {
  return {
    ...makeExistingIssue(),
    status: "backlog",
    labelIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  };
}

describe("issue mutation policy routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.create.mockResolvedValue(makeCreatedIssue());
    mockIssueService.getById.mockResolvedValue(makeExistingIssue());
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeExistingIssue(),
      ...patch,
    }));
    mockAgentService.getById.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      companyId: "company-1",
      metadata: null,
    });
  });

  it("rejects issue creation when labels are omitted", async () => {
    const res = await request(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }))
      .post("/api/companies/company-1/issues")
      .send({
        title: "새 이슈",
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Issues must include at least one label");
    expect(mockIssueService.create).not.toHaveBeenCalled();
  });

  it("rejects empty label updates but allows legacy unlabeled issues to patch other fields", async () => {
    const boardActor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };

    const rejectRes = await request(createApp(boardActor))
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ labelIds: [] });

    expect(rejectRes.status).toBe(422);
    expect(rejectRes.body.error).toBe("Issue label updates must include at least one label");
    expect(mockIssueService.update).not.toHaveBeenCalled();

    mockIssueService.getById.mockResolvedValueOnce({
      ...makeExistingIssue(),
      labelIds: [],
    });

    const allowedRes = await request(createApp(boardActor))
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ priority: "high" });

    expect(allowedRes.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      { priority: "high" },
    );
  });

  it("downgrades unauthorized agent done requests to in_review and logs the redirect", async () => {
    const res = await request(createApp({
      type: "agent",
      agentId: "22222222-2222-4222-8222-222222222222",
      companyId: "company-1",
      runId: "run-1",
    }))
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ status: "done" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      { status: "in_review" },
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.done_redirected",
        details: expect.objectContaining({
          requestedStatus: "done",
          appliedStatus: "in_review",
          reason: "missing_issue_completion_authority",
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.objectContaining({
          status: "in_review",
        }),
      }),
    );
  });

  it("allows authority agents and board users to mark issues done", async () => {
    mockAgentService.getById.mockResolvedValueOnce({
      id: "22222222-2222-4222-8222-222222222222",
      companyId: "company-1",
      metadata: { issueCompletionAuthority: true },
    });

    const agentRes = await request(createApp({
      type: "agent",
      agentId: "22222222-2222-4222-8222-222222222222",
      companyId: "company-1",
      runId: "run-1",
    }))
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ status: "done" });

    expect(agentRes.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      { status: "done" },
    );

    const boardRes = await request(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }))
      .patch("/api/issues/11111111-1111-4111-8111-111111111111")
      .send({ status: "done" });

    expect(boardRes.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenLastCalledWith(
      "11111111-1111-4111-8111-111111111111",
      { status: "done" },
    );
  });
});
