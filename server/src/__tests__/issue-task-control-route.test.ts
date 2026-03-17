import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  getChainOfCommand: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  getRun: vi.fn(),
  getActiveRunForAgent: vi.fn(),
  requestRunCancellation: vi.fn(),
  dispatchRunCancellation: vi.fn(),
  cancelRun: vi.fn(),
  wakeup: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  findMentionedAgents: vi.fn(),
  assertCheckoutOwner: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  heartbeatService: () => mockHeartbeatService,
  issueService: () => mockIssueService,
  goalService: () => ({}),
  projectService: () => ({}),
  issueApprovalService: () => ({}),
  documentService: () => ({}),
  logActivity: mockLogActivity,
}));

vi.mock("../middleware/logger.js", () => ({
  logger: mockLogger,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use(
    "/api",
    issueRoutes(
      {} as any,
      {
        deleteObject: vi.fn(),
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getSignedDownloadUrl: vi.fn(),
      } as any,
    ),
  );
  app.use(errorHandler);
  return app;
}

const baseIssue = {
  id: "issue-1",
  companyId: "company-1",
  identifier: "PAP-1",
  title: "Issue title",
  description: null,
  status: "in_progress",
  priority: "medium",
  assigneeAgentId: "agent-subordinate",
  assigneeUserId: null,
  createdByAgentId: null,
  createdByUserId: "user-1",
  projectId: null,
  goalId: null,
  parentId: null,
  requestDepth: 0,
  billingCode: null,
  hiddenAt: null,
  startedAt: new Date("2026-03-16T18:00:00.000Z"),
  completedAt: null,
  cancelledAt: null,
  checkoutRunId: null,
  executionRunId: "run-1",
  executionAgentNameKey: null,
  executionLockedAt: null,
  createdAt: new Date("2026-03-16T18:00:00.000Z"),
  updatedAt: new Date("2026-03-16T18:00:00.000Z"),
};

describe("PATCH /issues/:id task control", () => {
  beforeEach(() => {
    mockAccessService.hasPermission.mockReset().mockResolvedValue(false);
    mockAccessService.canUser.mockReset().mockResolvedValue(false);
    mockAgentService.getById.mockReset();
    mockAgentService.getChainOfCommand.mockReset();
    mockHeartbeatService.getRun.mockReset().mockResolvedValue({
      id: "run-1",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "running",
      contextSnapshot: { issueId: "issue-1" },
    });
    mockHeartbeatService.getActiveRunForAgent.mockReset().mockResolvedValue(null);
    mockHeartbeatService.requestRunCancellation.mockReset().mockResolvedValue({
      runId: "run-1",
      companyId: "company-1",
      agentId: "agent-subordinate",
      requestedStatus: "cancelling",
    });
    mockHeartbeatService.dispatchRunCancellation.mockReset().mockResolvedValue({
      id: "run-1",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "cancelled",
    });
    mockHeartbeatService.cancelRun.mockReset().mockResolvedValue({
      id: "run-1",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "cancelled",
    });
    mockHeartbeatService.wakeup.mockReset().mockResolvedValue(null);
    mockIssueService.getById.mockReset().mockResolvedValue(baseIssue);
    mockIssueService.getByIdentifier.mockReset().mockResolvedValue(null);
    mockIssueService.update.mockReset().mockImplementation(async (_id, patch, opts) => {
      const updated = {
        ...baseIssue,
        ...patch,
        assigneeAgentId: patch.assigneeAgentId ?? baseIssue.assigneeAgentId,
        assigneeUserId: patch.assigneeUserId ?? baseIssue.assigneeUserId,
        status: patch.status ?? baseIssue.status,
      };
      if (opts?.afterUpdateTx) {
        await opts.afterUpdateTx({
          tx: {} as any,
          existing: baseIssue,
          updated,
          patch,
          nextAssigneeAgentId: updated.assigneeAgentId,
          nextAssigneeUserId: updated.assigneeUserId,
        });
      }
      return updated;
    });
    mockIssueService.addComment.mockReset().mockResolvedValue({
      id: "comment-1",
      body: "ok",
    });
    mockIssueService.findMentionedAgents.mockReset().mockResolvedValue([]);
    mockIssueService.assertCheckoutOwner.mockReset().mockResolvedValue({});
    mockLogActivity.mockReset().mockResolvedValue(undefined);
    mockLogger.warn.mockReset();
  });

  it("allows CEO agent to cancel a subordinate issue and interrupts the active run", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "cancelled" }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith("run-1", expect.objectContaining({ tx: expect.anything() }));
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", requestedStatus: "cancelling" }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        entityType: "issue",
        entityId: "issue-1",
        details: expect.objectContaining({
          managedRunInterruption: {
            runId: "run-1",
            requestedStatus: "cancelling",
            outcome: "completed",
          },
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "heartbeat.cancelled", entityType: "heartbeat_run", entityId: "run-1" }),
    );
  });

  it("allows an ancestor manager with task-management permission to reassign a subordinate issue and interrupts the active run", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([
      { id: "agent-manager", name: "Manager", role: "manager", title: null },
    ]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: "00000000-0000-4000-8000-000000000002" });

    expect(res.status).toBe(200);
    expect(res.body.assigneeAgentId).toBe("00000000-0000-4000-8000-000000000002");
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", {
      assigneeAgentId: "00000000-0000-4000-8000-000000000002",
    }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith("run-1", expect.objectContaining({ tx: expect.anything() }));
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", requestedStatus: "cancelling" }),
    );
  });

  it("preserves legacy canCreateAgents-based task control for ancestor managers", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: true, canManageTasks: false },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([
      { id: "agent-manager", name: "Manager", role: "manager", title: null },
    ]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: "00000000-0000-4000-8000-000000000003" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", {
      assigneeAgentId: "00000000-0000-4000-8000-000000000003",
    }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith("run-1", expect.objectContaining({ tx: expect.anything() }));
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", requestedStatus: "cancelling" }),
    );
  });

  it("does not require chain-of-command for first assignment of an unowned issue", async () => {
    const unownedBaseIssue = {
      ...baseIssue,
      assigneeAgentId: null,
      executionRunId: null,
      status: "backlog",
    };
    mockIssueService.getById.mockResolvedValue(unownedBaseIssue);
    mockIssueService.update.mockImplementation(async (_id, patch) => ({
      ...unownedBaseIssue,
      ...patch,
      assigneeAgentId: patch.assigneeAgentId ?? null,
      assigneeUserId: patch.assigneeUserId ?? unownedBaseIssue.assigneeUserId,
      status: patch.status ?? "backlog",
    }));
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-other-manager", name: "Other", role: "manager", title: null }]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: "00000000-0000-4000-8000-000000000004" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", {
      assigneeAgentId: "00000000-0000-4000-8000-000000000004",
    }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).not.toHaveBeenCalled();
    expect(mockHeartbeatService.dispatchRunCancellation).not.toHaveBeenCalled();
    expect(mockAgentService.getChainOfCommand).not.toHaveBeenCalled();
  });

  it("rejects reassignment attempts when the acting agent lacks task-management permission", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: false },
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: "00000000-0000-4000-8000-000000000002" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Missing permission: tasks:assign");
    expect(mockIssueService.update).not.toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.task_control_denied",
        entityType: "issue",
        entityId: "issue-1",
        details: expect.objectContaining({
          reason: "missing_permission",
          managedAgentId: "agent-subordinate",
          requestedStatus: undefined,
        }),
      }),
    );
  });

  it("still returns 403 when denial logging fails for a missing-permission rejection", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: false },
    });
    mockLogActivity.mockRejectedValueOnce(new Error("activity db unavailable"));

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeAgentId: "00000000-0000-4000-8000-000000000002" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Missing permission: tasks:assign");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "issue-1", logErr: expect.any(Error) }),
      "failed to log task control denial",
    );
  });

  it("rejects reassignment attempts outside the acting agent's chain of command", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Only an ancestor manager can cancel, complete, or reassign another agent's issue");
    expect(mockIssueService.update).not.toHaveBeenCalled();
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.task_control_denied",
        entityType: "issue",
        entityId: "issue-1",
        details: expect.objectContaining({
          reason: "not_in_chain_of_command",
          managedAgentId: "agent-subordinate",
          requestedStatus: "cancelled",
        }),
      }),
    );
  });

  it("still returns 403 when denial logging fails for an out-of-chain rejection", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-manager",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);
    mockLogActivity.mockRejectedValueOnce(new Error("activity db unavailable"));

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Only an ancestor manager can cancel, complete, or reassign another agent's issue");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "issue-1", logErr: expect.any(Error) }),
      "failed to log task control denial",
    );
  });

  it("uses the active-run fallback when the issue has no executionRunId", async () => {
    mockIssueService.getById.mockResolvedValue({
      ...baseIssue,
      executionRunId: null,
    });
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);
    mockHeartbeatService.getRun.mockResolvedValue(null);
    mockHeartbeatService.getActiveRunForAgent.mockResolvedValue({
      id: "run-fallback",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "running",
      contextSnapshot: { issueId: "issue-1" },
    });
    mockHeartbeatService.cancelRun.mockResolvedValue({
      id: "run-fallback",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "cancelled",
    });
    mockHeartbeatService.requestRunCancellation.mockResolvedValue({
      runId: "run-fallback",
      companyId: "company-1",
      agentId: "agent-subordinate",
      requestedStatus: "cancelling",
    });
    mockHeartbeatService.dispatchRunCancellation.mockResolvedValue({
      id: "run-fallback",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "cancelled",
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith(
      "run-fallback",
      expect.objectContaining({ tx: expect.anything() }),
    );
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-fallback", requestedStatus: "cancelling" }),
    );
  });

  it("uses the tx-path fallback to cancel queued runs when executionRunId is missing", async () => {
    const queuedRun = {
      id: "run-queued",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "queued",
      contextSnapshot: { issueId: "issue-1" },
      startedAt: null,
      createdAt: new Date("2026-03-16T18:05:00.000Z"),
    };

    mockIssueService.getById.mockResolvedValue({
      ...baseIssue,
      executionRunId: null,
    });
    mockIssueService.update.mockImplementation(async (_id, patch, opts) => {
      const updated = {
        ...baseIssue,
        executionRunId: null,
        ...patch,
        assigneeAgentId: patch.assigneeAgentId ?? baseIssue.assigneeAgentId,
        assigneeUserId: patch.assigneeUserId ?? baseIssue.assigneeUserId,
        status: patch.status ?? baseIssue.status,
      };
      if (opts?.afterUpdateTx) {
        const tx = {
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: async () => [queuedRun],
                }),
              }),
            }),
          }),
        } as any;
        await opts.afterUpdateTx({
          tx,
          existing: { ...baseIssue, executionRunId: null },
          updated,
          patch,
          nextAssigneeAgentId: updated.assigneeAgentId,
          nextAssigneeUserId: updated.assigneeUserId,
        });
      }
      return updated;
    });
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);
    mockHeartbeatService.requestRunCancellation.mockResolvedValue({
      runId: "run-queued",
      companyId: "company-1",
      agentId: "agent-subordinate",
      requestedStatus: "cancelling",
    });
    mockHeartbeatService.dispatchRunCancellation.mockResolvedValue({
      id: "run-queued",
      companyId: "company-1",
      agentId: "agent-subordinate",
      status: "cancelled",
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(mockHeartbeatService.getActiveRunForAgent).not.toHaveBeenCalled();
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith(
      "run-queued",
      expect.objectContaining({ tx: expect.anything() }),
    );
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-queued", requestedStatus: "cancelling" }),
    );
  });

  it("does not interrupt when an agent updates its own issue", async () => {
    mockIssueService.getById.mockResolvedValue({
      ...baseIssue,
      assigneeAgentId: "agent-self",
    });
    mockAgentService.getById.mockResolvedValue({
      id: "agent-self",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: false },
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-self",
        companyId: "company-1",
        runId: "run-self",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "cancelled" }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).not.toHaveBeenCalled();
    expect(mockHeartbeatService.dispatchRunCancellation).not.toHaveBeenCalled();
  });

  it("does not apply the manager-only cancellation gate to unrelated updates on already-cancelled issues", async () => {
    mockIssueService.getById.mockResolvedValue({
      ...baseIssue,
      status: "cancelled",
      cancelledAt: new Date("2026-03-16T18:30:00.000Z"),
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-manager",
        companyId: "company-1",
        runId: "run-manager",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ priority: "high" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { priority: "high" }, expect.anything());
    expect(mockLogActivity).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "issue.task_control_denied" }),
    );
  });

  it("still updates the issue when no active run exists", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);
    mockHeartbeatService.getRun.mockResolvedValue(null);
    mockHeartbeatService.getActiveRunForAgent.mockResolvedValue(null);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "cancelled" }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).not.toHaveBeenCalled();
    expect(mockHeartbeatService.dispatchRunCancellation).not.toHaveBeenCalled();
  });

  it("requires chain-of-command and interrupts the run when another agent marks the issue done", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "done" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "done" }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).toHaveBeenCalledWith("run-1", expect.objectContaining({ tx: expect.anything() }));
    expect(mockHeartbeatService.dispatchRunCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", requestedStatus: "cancelling" }),
    );
  });

  it("does not look up or interrupt runs for idempotent done updates", async () => {
    mockIssueService.getById.mockResolvedValue({
      ...baseIssue,
      status: "done",
      completedAt: new Date("2026-03-16T18:30:00.000Z"),
    });
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "done" });

    expect(res.status).toBe(200);
    expect(mockHeartbeatService.getRun).not.toHaveBeenCalled();
    expect(mockHeartbeatService.getActiveRunForAgent).not.toHaveBeenCalled();
    expect(mockHeartbeatService.requestRunCancellation).not.toHaveBeenCalled();
    expect(mockHeartbeatService.dispatchRunCancellation).not.toHaveBeenCalled();
  });

  it("records dispatch failure on the issue update when cancelling the managed run throws", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-ceo",
      companyId: "company-1",
      role: "ceo",
      permissions: { canCreateAgents: true, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);
    mockHeartbeatService.dispatchRunCancellation.mockRejectedValue(new Error("db unavailable"));

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-ceo",
        companyId: "company-1",
        runId: "run-ceo",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "cancelled" }, expect.anything());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "issue-1", runId: "run-1", err: expect.any(Error) }),
      "failed to dispatch managed run interruption",
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        entityType: "issue",
        entityId: "issue-1",
        details: expect.objectContaining({
          managedRunInterruption: {
            runId: "run-1",
            requestedStatus: "cancelling",
            outcome: "dispatch_failed",
          },
        }),
      }),
    );
  });

  it("does not enforce chain-of-command or interrupt runs for assigneeUserId-only updates", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-outsider",
      companyId: "company-1",
      role: "manager",
      permissions: { canCreateAgents: false, canManageTasks: true },
    });
    mockAgentService.getChainOfCommand.mockResolvedValue([{ id: "agent-ceo", name: "CEO", role: "ceo", title: null }]);

    const res = await request(
      createApp({
        type: "agent",
        agentId: "agent-outsider",
        companyId: "company-1",
        runId: "run-outsider",
        source: "agent_key",
      }),
    )
      .patch("/api/issues/issue-1")
      .send({ assigneeUserId: "user-2" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { assigneeUserId: "user-2" }, expect.anything());
    expect(mockHeartbeatService.requestRunCancellation).not.toHaveBeenCalled();
    expect(mockHeartbeatService.dispatchRunCancellation).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "issue.task_control_denied" }),
    );
  });
});
