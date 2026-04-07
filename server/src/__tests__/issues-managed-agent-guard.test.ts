import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

// ---------------------------------------------------------------------------
// Mocks for the service layer used by issueRoutes()
// ---------------------------------------------------------------------------

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  listComments: vi.fn(),
  getComment: vi.fn(),
  assertCheckoutOwner: vi.fn(),
  list: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
  getRun: vi.fn(),
  getActiveRunForAgent: vi.fn(),
  cancelRun: vi.fn(),
}));

const mockProjectService = vi.hoisted(() => ({}));
const mockGoalService = vi.hoisted(() => ({}));
const mockIssueApprovalService = vi.hoisted(() => ({}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  goalService: () => mockGoalService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => mockProjectService,
}));

vi.mock("../services/live-events.js", () => ({
  publishLiveEvent: vi.fn(),
}));

vi.mock("../middleware/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("./issues-checkout-wakeup.js", () => ({
  shouldWakeAssigneeOnCheckout: () => false,
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const COMPANY_ID = "company-1";
const ISSUE_ID = "issue-1";

const baseIssue = {
  id: ISSUE_ID,
  companyId: COMPANY_ID,
  title: "Test issue",
  description: "body",
  status: "todo",
  priority: "medium",
  assigneeAgentId: "engineer-agent",
  assigneeUserId: null,
  createdByUserId: "user-1",
  createdByAgentId: null,
  parentId: null,
  projectId: null,
  goalId: null,
  identifier: "TST-1",
  hiddenAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-04-07T16:00:00.000Z"),
  updatedAt: new Date("2026-04-07T16:00:00.000Z"),
  issueNumber: 1,
  checkoutRunId: null,
  executionRunId: null,
  executionAgentNameKey: null,
  executionLockedAt: null,
};

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { actor: Record<string, unknown> }).actor = actor;
    next();
  });
  app.use("/api", issueRoutes({} as never, {} as never));
  app.use(errorHandler);
  return app;
}

function asAgent(agentId: string) {
  return {
    type: "agent" as const,
    agentId,
    companyId: COMPANY_ID,
    source: "agent_key",
    runId: "run-1",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("issues route — managed agent guard", () => {
  beforeEach(() => {
    mockIssueService.getById.mockReset().mockResolvedValue(baseIssue);
    mockIssueService.getByIdentifier.mockReset().mockResolvedValue(null);
    mockIssueService.update.mockReset().mockResolvedValue(baseIssue);
    mockIssueService.addComment.mockReset().mockResolvedValue({
      id: "comment-1",
      issueId: ISSUE_ID,
      body: "hello",
      authorAgentId: "assistant-agent",
      authorUserId: null,
      createdAt: new Date("2026-04-07T16:01:00.000Z"),
    });
    mockIssueService.assertCheckoutOwner.mockReset().mockResolvedValue({ adoptedFromRunId: null });
    mockAgentService.getById.mockReset();
    mockHeartbeatService.wakeup.mockReset().mockResolvedValue({ id: "run-x" });
    mockLogActivity.mockReset().mockResolvedValue(undefined);
  });

  describe("PATCH /issues/:id", () => {
    it("rejects 403 when called by an agent that has a manager", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "assistant-agent",
        companyId: COMPANY_ID,
        managerIds: ["engineer-agent"],
      });
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "I think this is done" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Managed agents/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
      expect(mockIssueService.addComment).not.toHaveBeenCalled();
    });

    it("allows the same PATCH from an agent without a manager", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "engineer-agent",
        companyId: COMPANY_ID,
        managerIds: [],
      });
      const app = createApp(asAgent("engineer-agent"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "Finished the work" });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalled();
    });
  });

  describe("POST /issues/:id/comments", () => {
    it("allows a managed agent to post a plain comment (no reopen, no interrupt)", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "assistant-agent",
        companyId: COMPANY_ID,
        managerIds: ["engineer-agent"],
      });
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "Here is my research output." });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.addComment).toHaveBeenCalled();
      // The managed agent's comment must NOT cause an issue update.
      expect(mockIssueService.update).not.toHaveBeenCalled();
    });

    it("rejects 403 when a managed agent posts with reopen=true", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "assistant-agent",
        companyId: COMPANY_ID,
        managerIds: ["engineer-agent"],
      });
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "reopening", reopen: true });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/reopening or interrupting/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
      expect(mockIssueService.addComment).not.toHaveBeenCalled();
    });

    it("rejects 403 when a managed agent posts with interrupt=true", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "assistant-agent",
        companyId: COMPANY_ID,
        managerIds: ["engineer-agent"],
      });
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "interrupting", interrupt: true });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/reopening or interrupting/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
    });

    it("allows an unmanaged agent to post with reopen=true on a closed issue", async () => {
      mockIssueService.getById.mockResolvedValue({ ...baseIssue, status: "done" });
      mockIssueService.update.mockResolvedValue({ ...baseIssue, status: "todo" });
      mockAgentService.getById.mockResolvedValue({
        id: "engineer-agent",
        companyId: COMPANY_ID,
        managerIds: [],
      });
      const app = createApp(asAgent("engineer-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "reopening to address feedback", reopen: true });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalledWith(ISSUE_ID, { status: "todo" });
    });
  });
});
