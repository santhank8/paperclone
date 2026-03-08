import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";

const mocks = vi.hoisted(() => ({
  getLabelById: vi.fn(),
  countIssuesUsingLabel: vi.fn(),
  deleteLabel: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({}),
  agentService: () => ({ getById: vi.fn() }),
  goalService: () => ({ getById: vi.fn() }),
  heartbeatService: () => ({}),
  issueApprovalService: () => ({}),
  issueService: () => ({
    getLabelById: mocks.getLabelById,
    countIssuesUsingLabel: mocks.countIssuesUsingLabel,
    deleteLabel: mocks.deleteLabel,
  }),
  logActivity: mocks.logActivity,
  projectService: () => ({ getById: vi.fn(), listByIds: vi.fn() }),
}));

function makeApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  return app;
}

describe("issue label delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires board authentication", async () => {
    const app = makeApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "agent_key",
    });

    const res = await request(app).delete("/api/companies/company-1/labels/label-1");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Board authentication required" });
  });

  it("returns 409 with issue count when label is in use", async () => {
    mocks.getLabelById.mockResolvedValue({ id: "label-1", companyId: "company-1", name: "type:bug", color: "#f00" });
    mocks.countIssuesUsingLabel.mockResolvedValue(3);

    const app = makeApp({
      type: "board",
      source: "local_implicit",
      userId: "local-board",
      companyIds: ["company-1"],
      isInstanceAdmin: true,
    });

    const res = await request(app).delete("/api/companies/company-1/labels/label-1");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Label is in use", issueCount: 3 });
    expect(mocks.deleteLabel).not.toHaveBeenCalled();
  });

  it("returns 204 when label is deleted", async () => {
    mocks.getLabelById.mockResolvedValue({ id: "label-1", companyId: "company-1", name: "type:bug", color: "#f00" });
    mocks.countIssuesUsingLabel.mockResolvedValue(0);
    mocks.deleteLabel.mockResolvedValue({ id: "label-1", companyId: "company-1", name: "type:bug", color: "#f00" });

    const app = makeApp({
      type: "board",
      source: "local_implicit",
      userId: "local-board",
      companyIds: ["company-1"],
      isInstanceAdmin: true,
    });

    const res = await request(app).delete("/api/companies/company-1/labels/label-1");

    expect(res.status).toBe(204);
    expect(mocks.deleteLabel).toHaveBeenCalledWith("label-1");
    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
  });
});
