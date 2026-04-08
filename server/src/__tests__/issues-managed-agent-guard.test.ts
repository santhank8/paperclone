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

// Three agent shapes used throughout these tests:
//
//   - assistant       : DeerFlow adapter, has a manager        → blocked
//   - managed engineer: claude_local adapter, has a manager    → ALLOWED
//   - top-level agent : either adapter, no manager             → ALLOWED
//
// The "managed engineer" case is the regression that the original guard
// missed: senior engineers (Sr. Backend Engineer, etc.) all report to CTO,
// so their managerIds are non-empty, but they are full executors and must
// retain every lifecycle mutation right.
const ASSISTANT_AGENT = {
  id: "assistant-agent",
  companyId: COMPANY_ID,
  adapterType: "deerflow",
  managerIds: ["engineer-agent"],
};
const MANAGED_ENGINEER = {
  id: "engineer-agent",
  companyId: COMPANY_ID,
  adapterType: "claude_local",
  managerIds: ["cto-agent"],
};
const TOP_LEVEL_AGENT = {
  id: "cto-agent",
  companyId: COMPANY_ID,
  adapterType: "claude_local",
  managerIds: [],
};

describe("issues route — managed assistant guard", () => {
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
    it("rejects 403 when called by a DeerFlow assistant with a manager", async () => {
      mockAgentService.getById.mockResolvedValue(ASSISTANT_AGENT);
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "I think this is done" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Managed research assistants/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
      expect(mockIssueService.addComment).not.toHaveBeenCalled();
    });

    // Regression coverage for the bug that originally shipped: a managed
    // engineer (claude_local agent that reports to a manager) was being
    // incorrectly treated as a managed assistant and blocked from PATCH.
    // This test fails against the buggy `managerIds.length > 0`-only check.
    it("ALLOWS PATCH from a senior engineer (claude_local) that reports to a manager", async () => {
      mockAgentService.getById.mockResolvedValue(MANAGED_ENGINEER);
      const app = createApp(asAgent("engineer-agent"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "Engineer marking work done" });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalled();
    });

    it("allows PATCH from a top-level agent with no manager", async () => {
      mockAgentService.getById.mockResolvedValue(TOP_LEVEL_AGENT);
      const app = createApp(asAgent("cto-agent"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "CTO closing this out" });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalled();
    });

    // A DeerFlow agent without any manager is a top-level research agent
    // (not a subordinate). Such an agent isn't constrained by this guard —
    // the guard exists to enforce hierarchical review, and a top-level
    // agent has no one to review its decisions.
    it("allows PATCH from a top-level DeerFlow agent (no manager)", async () => {
      mockAgentService.getById.mockResolvedValue({
        id: "standalone-deerflow",
        companyId: COMPANY_ID,
        adapterType: "deerflow",
        managerIds: [],
      });
      const app = createApp(asAgent("standalone-deerflow"));

      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done" });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalled();
    });
  });

  describe("POST /issues/:id/comments", () => {
    it("allows a managed assistant to post a plain comment (no reopen, no interrupt)", async () => {
      mockAgentService.getById.mockResolvedValue(ASSISTANT_AGENT);
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "Here is my research output." });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.addComment).toHaveBeenCalled();
      // The assistant's plain comment must NOT cause an issue update.
      expect(mockIssueService.update).not.toHaveBeenCalled();
    });

    it("rejects 403 when a managed assistant posts with reopen=true", async () => {
      mockAgentService.getById.mockResolvedValue(ASSISTANT_AGENT);
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "reopening", reopen: true });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/reopening or interrupting/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
      expect(mockIssueService.addComment).not.toHaveBeenCalled();
    });

    it("rejects 403 when a managed assistant posts with interrupt=true", async () => {
      mockAgentService.getById.mockResolvedValue(ASSISTANT_AGENT);
      const app = createApp(asAgent("assistant-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "interrupting", interrupt: true });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/reopening or interrupting/i);
      expect(mockIssueService.update).not.toHaveBeenCalled();
    });

    // Regression coverage for the same engineer-blocking bug as the PATCH
    // test above — engineers must be able to reopen issues via comment
    // (e.g. to retry a previously-failed delegation cycle).
    it("ALLOWS a managed engineer to post with reopen=true on a closed issue", async () => {
      mockIssueService.getById.mockResolvedValue({ ...baseIssue, status: "done" });
      mockIssueService.update.mockResolvedValue({ ...baseIssue, status: "todo" });
      mockAgentService.getById.mockResolvedValue(MANAGED_ENGINEER);
      const app = createApp(asAgent("engineer-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "reopening to address feedback", reopen: true });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalledWith(ISSUE_ID, { status: "todo" });
    });

    it("allows a top-level agent to post with reopen=true on a closed issue", async () => {
      mockIssueService.getById.mockResolvedValue({ ...baseIssue, status: "done" });
      mockIssueService.update.mockResolvedValue({ ...baseIssue, status: "todo" });
      mockAgentService.getById.mockResolvedValue(TOP_LEVEL_AGENT);
      const app = createApp(asAgent("cto-agent"));

      const res = await request(app)
        .post(`/api/issues/${ISSUE_ID}/comments`)
        .send({ body: "reopening", reopen: true });

      expect(res.status).not.toBe(403);
      expect(mockIssueService.update).toHaveBeenCalledWith(ISSUE_ID, { status: "todo" });
    });
  });
});
