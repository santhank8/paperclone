import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvalRoutes } from "../routes/approvals.js";
import { errorHandler } from "../middleware/index.js";

const mockApprovalService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  requestRevision: vi.fn(),
  resubmit: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  listIssuesForApproval: vi.fn(),
  linkManyForApproval: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeHireApprovalPayloadForPersistence: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  approvalService: () => mockApprovalService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
}));

function createApp() {
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
  app.use("/api", approvalRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("approval routes idempotent retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "wake-1" });
    mockIssueApprovalService.listIssuesForApproval.mockResolvedValue([{ id: "issue-1" }]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("does not emit duplicate approval side effects when approve is already resolved", async () => {
    mockApprovalService.approve.mockResolvedValue({
      approval: {
        id: "approval-1",
        companyId: "company-1",
        type: "hire_agent",
        status: "approved",
        payload: {},
        requestedByAgentId: "agent-1",
      },
      applied: false,
    });

    const res = await request(createApp())
      .post("/api/approvals/approval-1/approve")
      .send({});

    expect(res.status).toBe(200);
    expect(mockIssueApprovalService.listIssuesForApproval).not.toHaveBeenCalled();
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("does not emit duplicate rejection logs when reject is already resolved", async () => {
    mockApprovalService.reject.mockResolvedValue({
      approval: {
        id: "approval-1",
        companyId: "company-1",
        type: "hire_agent",
        status: "rejected",
        payload: {},
      },
      applied: false,
    });

    const res = await request(createApp())
      .post("/api/approvals/approval-1/reject")
      .send({});

    expect(res.status).toBe(200);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("wakes the requesting agent when an approval is rejected", async () => {
    mockApprovalService.reject.mockResolvedValue({
      approval: {
        id: "approval-1",
        companyId: "company-1",
        type: "hire_agent",
        status: "rejected",
        decisionNote: "Not yet",
        payload: {},
        requestedByAgentId: "agent-1",
      },
      applied: true,
    });

    const res = await request(createApp())
      .post("/api/approvals/approval-1/reject")
      .send({ decisionNote: "Not yet" });

    expect(res.status).toBe(200);
    expect(mockIssueApprovalService.listIssuesForApproval).toHaveBeenCalledWith("approval-1");
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        reason: "approval_rejected",
        payload: expect.objectContaining({
          approvalId: "approval-1",
          approvalStatus: "rejected",
          decisionNote: "Not yet",
          wakeReason: "approval_rejected",
        }),
        contextSnapshot: expect.objectContaining({
          source: "approval.rejected",
          wakeReason: "approval_rejected",
          decisionNote: "Not yet",
        }),
      }),
    );
  });

  it("wakes the requesting agent when an approval needs revision", async () => {
    mockApprovalService.requestRevision.mockResolvedValue({
      id: "approval-1",
      companyId: "company-1",
      type: "hire_agent",
      status: "revision_requested",
      decisionNote: "Please tighten the scope",
      payload: {},
      requestedByAgentId: "agent-1",
    });

    const res = await request(createApp())
      .post("/api/approvals/approval-1/request-revision")
      .send({ decisionNote: "Please tighten the scope" });

    expect(res.status).toBe(200);
    expect(mockIssueApprovalService.listIssuesForApproval).toHaveBeenCalledWith("approval-1");
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        reason: "approval_revision_requested",
        payload: expect.objectContaining({
          approvalId: "approval-1",
          approvalStatus: "revision_requested",
          decisionNote: "Please tighten the scope",
          wakeReason: "approval_revision_requested",
        }),
        contextSnapshot: expect.objectContaining({
          source: "approval.revision_requested",
          wakeReason: "approval_revision_requested",
          decisionNote: "Please tighten the scope",
        }),
      }),
    );
  });

  it.each([
    [{ body: "Board note" }, "Board note"],
    [{ content: "Compatibility note" }, "Compatibility note"],
    [{ comments: "Legacy note" }, "Legacy note"],
  ])("accepts approval comment payload aliases: %j", async (payload, expectedBody) => {
    mockApprovalService.getById.mockResolvedValue({
      id: "approval-1",
      companyId: "company-1",
      type: "hire_agent",
      status: "approved",
      payload: {},
    });
    mockApprovalService.addComment.mockResolvedValue({
      id: "comment-1",
      approvalId: "approval-1",
      body: expectedBody,
    });

    const res = await request(createApp())
      .post("/api/approvals/approval-1/comments")
      .send(payload);

    expect(res.status).toBe(201);
    expect(mockApprovalService.addComment).toHaveBeenCalledWith(
      "approval-1",
      expectedBody,
      expect.objectContaining({
        userId: "user-1",
      }),
    );
  });
});
