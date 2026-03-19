import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { issueRoutes } from "../routes/issues.js";

const mockDocumentService = vi.hoisted(() => ({
  listCompanyDocuments: vi.fn(),
  listIssueDocuments: vi.fn(),
  getIssueDocumentByKey: vi.fn(),
  getIssueDocumentPayload: vi.fn(),
  upsertIssueDocument: vi.fn(),
  deleteIssueDocument: vi.fn(),
  listIssueDocumentRevisions: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  listComments: vi.fn(),
  checkout: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
  documentService: () => mockDocumentService,
  accessService: () => ({ ensureCompanyAccess: vi.fn() }),
  heartbeatService: () => ({ findActiveRun: vi.fn() }),
  agentService: () => ({ getById: vi.fn() }),
  projectService: () => ({ getById: vi.fn() }),
  goalService: () => ({ getById: vi.fn() }),
  issueApprovalService: () => ({ list: vi.fn() }),
  executionWorkspaceService: () => ({ getById: vi.fn() }),
  workProductService: () => ({ listForIssue: vi.fn() }),
  logActivity: vi.fn(),
}));

vi.mock("../routes/issues-checkout-wakeup.js", () => ({
  shouldWakeAssigneeOnCheckout: vi.fn().mockReturnValue(false),
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
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("GET /api/companies/:companyId/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns company-wide document list", async () => {
    const docs = [
      {
        id: "doc-1",
        companyId: "company-1",
        issueId: "issue-1",
        issueIdentifier: "PAP-1",
        issueTitle: "Test Issue",
        key: "plan",
        title: "Plan",
        format: "markdown",
        latestRevisionNumber: 2,
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      },
    ];
    mockDocumentService.listCompanyDocuments.mockResolvedValue(docs);

    const res = await request(createApp()).get("/api/companies/company-1/documents");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: "doc-1",
      issueIdentifier: "PAP-1",
      issueTitle: "Test Issue",
      key: "plan",
    });
    expect(mockDocumentService.listCompanyDocuments).toHaveBeenCalledWith("company-1");
  });

  it("returns empty array when no documents exist", async () => {
    mockDocumentService.listCompanyDocuments.mockResolvedValue([]);

    const res = await request(createApp()).get("/api/companies/company-1/documents");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("rejects access to other company documents", async () => {
    const res = await request(createApp()).get("/api/companies/other-company/documents");

    expect(res.status).toBe(403);
    expect(mockDocumentService.listCompanyDocuments).not.toHaveBeenCalled();
  });
});
