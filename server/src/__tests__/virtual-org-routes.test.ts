import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { virtualOrgRoutes } from "../routes/virtual-org.js";

const mockVirtualOrgService = vi.hoisted(() => ({
  portfolio: vi.fn(),
  bootstrapDefaults: vi.fn(),
  workspace: vi.fn(),
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  listInbox: vi.fn(),
  syncOfficelyV1: vi.fn(),
  saveOfficelyInternalDatabaseSetup: vi.fn(),
  testOfficelyInternalDatabaseSetup: vi.fn(),
  createInboxItem: vi.fn(),
  clarifyInboxItem: vi.fn(),
}));

vi.mock("../services/virtual-org.js", () => ({
  virtualOrgService: () => mockVirtualOrgService,
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
  app.use("/api", virtualOrgRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("virtual org routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates inbox items through the shared intake route", async () => {
    mockVirtualOrgService.createInboxItem.mockResolvedValue({ id: "item-1", status: "task_created" });

    const res = await request(createApp())
      .post("/api/virtual-org/inbox")
      .send({ companyId: "8e8216c5-4ea8-45ba-8e7e-c985f4e89ea3", rawContent: "Look into conversion drop" });

    expect(res.status).toBe(201);
    expect(mockVirtualOrgService.createInboxItem).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "8e8216c5-4ea8-45ba-8e7e-c985f4e89ea3",
        rawContent: "Look into conversion drop",
      }),
    );
  });

  it("routes clarification replies back to the same inbox item", async () => {
    mockVirtualOrgService.clarifyInboxItem.mockResolvedValue({ id: "item-1", status: "task_created" });

    const res = await request(createApp())
      .post("/api/virtual-org/inbox/item-1/clarify")
      .send({
        companyId: "8e8216c5-4ea8-45ba-8e7e-c985f4e89ea3",
        clarificationReply: "This is for Officely.",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.clarifyInboxItem).toHaveBeenCalledWith(
      "item-1",
      "8e8216c5-4ea8-45ba-8e7e-c985f4e89ea3",
      "This is for Officely.",
    );
  });

  it("runs the Officely manual sync for the selected company", async () => {
    mockVirtualOrgService.syncOfficelyV1.mockResolvedValue({
      companyId: "company-1",
      profileCount: 2,
      insightCount: 1,
      counts: {
        internalAccounts: 2,
        xeroInvoices: 0,
        stripeEvents: 0,
        posthogAccounts: 0,
      },
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/sync-v1")
      .send({});

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.syncOfficelyV1).toHaveBeenCalledWith("company-1");
  });

  it("saves the Officely internal database setup", async () => {
    mockVirtualOrgService.saveOfficelyInternalDatabaseSetup.mockResolvedValue({
      companyId: "company-1",
      connectorId: "connector-1",
      secretName: "OFFICELY_INTERNAL_DATABASE_URL",
      hasSavedConnection: true,
      queryConfigured: true,
      accountCount: 12,
      sampleCompanies: ["Acme Ltd"],
      usedSavedConnection: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/internal-database/setup")
      .send({
        connectionString: "postgres://demo",
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.saveOfficelyInternalDatabaseSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        connectionString: "postgres://demo",
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      }),
    );
  });

  it("tests the Officely internal database setup", async () => {
    mockVirtualOrgService.testOfficelyInternalDatabaseSetup.mockResolvedValue({
      companyId: "company-1",
      accountCount: 12,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      usedSavedConnection: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/internal-database/test")
      .send({
        connectionString: "postgres://demo",
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.testOfficelyInternalDatabaseSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        connectionString: "postgres://demo",
        sqlQuery: "select internal_account_id, company_name from customer_accounts",
      }),
    );
  });
});
