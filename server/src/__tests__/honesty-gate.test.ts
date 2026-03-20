import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const ISSUE_ID = "22222222-2222-2222-2222-222222222222";
const AGENT_ID = "33333333-3333-3333-3333-333333333333";
const RUN_ID = "44444444-4444-4444-4444-444444444444";

const baseIssue = {
  id: ISSUE_ID,
  companyId: COMPANY_ID,
  status: "in_progress",
  assigneeAgentId: AGENT_ID,
  assigneeUserId: null,
  projectId: null,
  goalId: null,
  parentId: null,
  title: "Test issue",
  description: null,
  priority: "medium",
  checkoutRunId: RUN_ID,
  executionRunId: null,
  executionAgentNameKey: null,
  executionLockedAt: null,
  createdByAgentId: AGENT_ID,
  createdByUserId: null,
  issueNumber: 1,
  identifier: "HSU-1",
  requestDepth: 0,
  billingCode: null,
  assigneeAdapterOverrides: null,
  executionWorkspaceId: null,
  executionWorkspacePreference: null,
  executionWorkspaceSettings: null,
  verification: null,
  startedAt: new Date(),
  completedAt: null,
  cancelledAt: null,
  hiddenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  labelIds: [],
  labels: [],
};

const validVerification = {
  specComplete: true,
  tested: true,
  matchesPlan: true,
  knowledgeSaved: true,
  bestSolutionCheck: true,
  notes: "All checks passed",
};

vi.mock("../services/index.js", () => ({
  issueService: () => ({
    getById: vi.fn().mockResolvedValue(baseIssue),
    update: vi.fn().mockResolvedValue({ ...baseIssue, status: "done", completedAt: new Date() }),
    addComment: vi.fn().mockResolvedValue({ id: "comment-1", body: "done", issueId: ISSUE_ID, companyId: COMPANY_ID }),
    assertCheckoutOwner: vi.fn().mockResolvedValue({}),
    getAncestors: vi.fn().mockResolvedValue([]),
    findMentionedAgents: vi.fn().mockResolvedValue([]),
    findMentionedProjectIds: vi.fn().mockResolvedValue([]),
    listComments: vi.fn().mockResolvedValue([]),
    getComment: vi.fn().mockResolvedValue(null),
    listLabels: vi.fn().mockResolvedValue([]),
    getLabelById: vi.fn().mockResolvedValue(null),
    listAttachments: vi.fn().mockResolvedValue([]),
    getAttachmentById: vi.fn().mockResolvedValue(null),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    checkout: vi.fn(),
    release: vi.fn(),
    markRead: vi.fn(),
    createAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    getByIdentifier: vi.fn().mockResolvedValue(null),
    getWorkProduct: vi.fn().mockResolvedValue(null),
    listWorkProducts: vi.fn().mockResolvedValue([]),
    upsertWorkProduct: vi.fn(),
    removeWorkProduct: vi.fn(),
    getDocument: vi.fn().mockResolvedValue(null),
    listDocuments: vi.fn().mockResolvedValue([]),
    upsertDocument: vi.fn(),
    removeDocument: vi.fn(),
  }),
  accessService: () => ({
    canUser: vi.fn().mockResolvedValue(true),
    hasPermission: vi.fn().mockResolvedValue(true),
  }),
  agentService: () => ({
    getById: vi.fn().mockResolvedValue({
      id: AGENT_ID,
      companyId: COMPANY_ID,
      role: "general",
      permissions: {},
    }),
  }),
  heartbeatService: () => ({
    wakeup: vi.fn().mockResolvedValue(undefined),
    getRun: vi.fn().mockResolvedValue(null),
    getActiveRunForAgent: vi.fn().mockResolvedValue(null),
    cancelRun: vi.fn().mockResolvedValue(null),
  }),
  projectService: () => ({
    getById: vi.fn().mockResolvedValue(null),
    listByIds: vi.fn().mockResolvedValue([]),
  }),
  goalService: () => ({
    getById: vi.fn().mockResolvedValue(null),
  }),
  issueApprovalService: () => ({
    listApprovalsForIssue: vi.fn().mockResolvedValue([]),
    link: vi.fn(),
    unlink: vi.fn(),
  }),
  executionWorkspaceService: () => ({
    getById: vi.fn().mockResolvedValue(null),
  }),
  logActivity: vi.fn(),
}));

function createApp(actorType: "agent" | "board") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (actorType === "agent") {
      (req as any).actor = {
        type: "agent",
        agentId: AGENT_ID,
        runId: RUN_ID,
        companyId: COMPANY_ID,
      };
    } else {
      (req as any).actor = {
        type: "board",
        userId: "board-user",
        source: "local_implicit",
      };
    }
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  return app;
}

describe("Honesty Gate — PATCH /api/issues/:id", () => {
  describe("agent-initiated transition to done", () => {
    it("returns 422 when verification is missing", async () => {
      const app = createApp("agent");
      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .set("X-Paperclip-Run-Id", RUN_ID)
        .send({ status: "done", comment: "done" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("VerificationRequired");
      expect(Array.isArray(res.body.missingChecks)).toBe(true);
      expect(res.body.missingChecks).toContain("specComplete");
    });

    it("returns 422 when any verification boolean is false", async () => {
      const app = createApp("agent");
      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .set("X-Paperclip-Run-Id", RUN_ID)
        .send({
          status: "done",
          comment: "done",
          verification: { ...validVerification, tested: false, specComplete: false },
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("VerificationRequired");
      expect(res.body.missingChecks).toContain("tested");
      expect(res.body.missingChecks).toContain("specComplete");
    });

    it("returns 200 when full valid verification is provided", async () => {
      const app = createApp("agent");
      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .set("X-Paperclip-Run-Id", RUN_ID)
        .send({
          status: "done",
          comment: "All done",
          verification: validVerification,
        });

      expect(res.status).toBe(200);
    });
  });

  describe("board-initiated transition to done", () => {
    it("bypasses honesty gate and returns 200 without verification", async () => {
      const app = createApp("board");
      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .send({ status: "done", comment: "board override" });

      expect(res.status).toBe(200);
    });
  });

  describe("non-done status transitions for agents", () => {
    it("does not require verification for transitions to blocked", async () => {
      const app = createApp("agent");
      const res = await request(app)
        .patch(`/api/issues/${ISSUE_ID}`)
        .set("X-Paperclip-Run-Id", RUN_ID)
        .send({ status: "blocked", comment: "blocked on external dep" });

      expect(res.status).toBe(200);
    });
  });
});
