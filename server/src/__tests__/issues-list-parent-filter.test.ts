import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";

const { listSpy, agentGetByIdSpy, heartbeatGetRunSpy, logActivitySpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  agentGetByIdSpy: vi.fn(),
  heartbeatGetRunSpy: vi.fn(),
  logActivitySpy: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: agentGetByIdSpy,
  }),
  approvalService: () => ({}),
  artifactService: () => ({
    upsertFromIssueComment: vi.fn(),
    upsertFromIssueAttachment: vi.fn(),
    removeBySource: vi.fn(),
  }),
  goalService: () => ({
    getById: vi.fn(),
  }),
  heartbeatService: () => ({
    getRun: heartbeatGetRunSpy,
  }),
  issueApprovalService: () => ({}),
  issueService: () => ({
    list: listSpy,
  }),
  logActivity: logActivitySpy,
  projectService: () => ({
    getById: vi.fn(),
  }),
}));

function createApp(
  actor: Record<string, unknown> = {
    type: "board",
    userId: "board-1",
    source: "local_implicit",
  },
) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  return app;
}

describe("issues list route", () => {
  beforeEach(() => {
    listSpy.mockReset();
    listSpy.mockResolvedValue([]);
    agentGetByIdSpy.mockReset();
    heartbeatGetRunSpy.mockReset();
    logActivitySpy.mockReset();
    logActivitySpy.mockResolvedValue(undefined);
  });

  it("forwards parentId query filter to issueService.list", async () => {
    const app = createApp();

    const res = await request(app)
      .get("/api/companies/company-1/issues")
      .query({
        parentId: "parent-issue-1",
        status: "draft",
      });

    expect(res.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        parentId: "parent-issue-1",
        status: "draft",
      }),
    );
  });

  it("blocks broad agent scans for strict callback wakes", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
    });
    agentGetByIdSpy.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      runtimeConfig: {
        heartbeat: {
          strictTargetedRetrieval: true,
        },
      },
    });
    heartbeatGetRunSpy.mockResolvedValue({
      companyId: "company-1",
      agentId: "agent-1",
      contextSnapshot: { wakeReason: "child_issue_blocked" },
    });
    listSpy.mockResolvedValue([]);

    const res = await request(app).get("/api/companies/company-1/issues");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Broad polling disabled",
      code: "broad_polling_disabled",
    });
    expect(res.headers["x-paperclip-agent-query-warning"]).toBe("broad_scan_blocked");
  });
});