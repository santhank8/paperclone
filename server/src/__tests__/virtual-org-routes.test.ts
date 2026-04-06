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
  saveOfficelyXeroSetup: vi.fn(),
  testOfficelyXeroSetup: vi.fn(),
  saveOfficelySlackSetup: vi.fn(),
  testOfficelySlackSetup: vi.fn(),
  saveOfficelyStripeSetup: vi.fn(),
  testOfficelyStripeSetup: vi.fn(),
  saveOfficelyPostHogSetup: vi.fn(),
  testOfficelyPostHogSetup: vi.fn(),
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

  it("saves the Officely Xero setup", async () => {
    mockVirtualOrgService.saveOfficelyXeroSetup.mockResolvedValue({
      companyId: "company-1",
      connectorId: "connector-xero",
      hasSavedClientId: true,
      hasSavedClientSecret: true,
      invoiceCount: 24,
      cashReceiptCount: 18,
      stripeCashReceiptCount: 16,
      manualPaymentCount: 5,
      sampleCompanies: ["Acme Ltd"],
      latestStripeCashReceipts: [],
      usedSavedClientId: false,
      usedSavedClientSecret: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/xero/setup")
      .send({
        clientId: "xero-client-id",
        clientSecret: "xero-client-secret",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.saveOfficelyXeroSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        clientId: "xero-client-id",
        clientSecret: "xero-client-secret",
      }),
    );
  });

  it("tests the Officely Xero setup", async () => {
    mockVirtualOrgService.testOfficelyXeroSetup.mockResolvedValue({
      companyId: "company-1",
      invoiceCount: 24,
      cashReceiptCount: 18,
      stripeCashReceiptCount: 16,
      manualPaymentCount: 5,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      latestStripeCashReceipts: [],
      usedSavedClientId: false,
      usedSavedClientSecret: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/xero/test")
      .send({
        clientId: "xero-client-id",
        clientSecret: "xero-client-secret",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.testOfficelyXeroSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        clientId: "xero-client-id",
        clientSecret: "xero-client-secret",
      }),
    );
  });

  it("saves the Officely Stripe setup", async () => {
    mockVirtualOrgService.saveOfficelyStripeSetup.mockResolvedValue({
      companyId: "company-1",
      connectorId: "connector-stripe",
      hasSavedSecretKey: true,
      eventCount: 9,
      failedPaymentCount: 2,
      refundCount: 1,
      cancellationCount: 1,
      upgradeCount: 3,
      downgradeCount: 2,
      sampleCompanies: ["Acme Ltd"],
      usedSavedSecretKey: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/stripe/setup")
      .send({
        secretKey: "rk_live_officely",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.saveOfficelyStripeSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        secretKey: "rk_live_officely",
      }),
    );
  });

  it("saves the Officely Slack setup", async () => {
    mockVirtualOrgService.saveOfficelySlackSetup.mockResolvedValue({
      companyId: "company-1",
      connectorId: "connector-slack",
      enabled: true,
      hasSavedBotToken: true,
      hasSavedAppToken: true,
      teamId: "T123",
      teamName: "Officely",
      botUserId: "U123",
      botUserName: "officely-bot",
      appId: "A123",
      defaultChannelId: "C123",
      founderUserId: "UCEO",
      intakeMode: "dm_and_channel",
      usedSavedBotToken: false,
      usedSavedAppToken: false,
      checkedAt: "2026-04-03T00:00:00.000Z",
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/slack/setup")
      .send({
        enabled: true,
        botToken: "xoxb-demo",
        appToken: "xapp-demo",
        defaultChannelId: "C123",
        founderUserId: "UCEO",
        intakeMode: "dm_and_channel",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.saveOfficelySlackSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        enabled: true,
        botToken: "xoxb-demo",
        appToken: "xapp-demo",
        defaultChannelId: "C123",
        founderUserId: "UCEO",
        intakeMode: "dm_and_channel",
      }),
    );
  });

  it("tests the Officely Slack setup", async () => {
    mockVirtualOrgService.testOfficelySlackSetup.mockResolvedValue({
      companyId: "company-1",
      enabled: true,
      teamId: "T123",
      teamName: "Officely",
      botUserId: "U123",
      botUserName: "officely-bot",
      appId: "A123",
      defaultChannelId: "C123",
      founderUserId: "UCEO",
      intakeMode: "dm_only",
      usedSavedBotToken: true,
      usedSavedAppToken: true,
      checkedAt: "2026-04-03T00:00:00.000Z",
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/slack/test")
      .send({
        enabled: true,
        intakeMode: "dm_only",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.testOfficelySlackSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        enabled: true,
        intakeMode: "dm_only",
      }),
    );
  });

  it("tests the Officely Stripe setup", async () => {
    mockVirtualOrgService.testOfficelyStripeSetup.mockResolvedValue({
      companyId: "company-1",
      eventCount: 9,
      failedPaymentCount: 2,
      refundCount: 1,
      cancellationCount: 1,
      upgradeCount: 3,
      downgradeCount: 2,
      sampleCompanies: ["Acme Ltd", "Beta LLC"],
      usedSavedSecretKey: false,
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/stripe/test")
      .send({
        secretKey: "rk_live_officely",
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.testOfficelyStripeSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        secretKey: "rk_live_officely",
      }),
    );
  });

  it("saves the Officely PostHog setup", async () => {
    mockVirtualOrgService.saveOfficelyPostHogSetup.mockResolvedValue({
      companyId: "company-1",
      connectorId: "connector-posthog",
      enabled: true,
      hasSavedApiKey: true,
      projectId: "12345",
      baseUrl: "https://us.posthog.com",
      eventCount: 42,
      activeUserTotal: 18,
      onboardingEvent: "user onboarded",
      onboardingEventCount: 6,
      importantEvents: ["report created", "workflow completed"],
      importantEventCounts: [
        { eventName: "report created", count: 12 },
        { eventName: "workflow completed", count: 8 },
      ],
      usedSavedApiKey: false,
      checkedAt: "2026-04-03T00:00:00.000Z",
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/posthog/setup")
      .send({
        enabled: true,
        apiKey: "phx_demo",
        projectId: "12345",
        baseUrl: "https://us.posthog.com",
        onboardingEvent: "user onboarded",
        importantEvents: ["report created", "workflow completed"],
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.saveOfficelyPostHogSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        enabled: true,
        apiKey: "phx_demo",
        projectId: "12345",
        onboardingEvent: "user onboarded",
        importantEvents: ["report created", "workflow completed"],
      }),
    );
  });

  it("tests the Officely PostHog setup", async () => {
    mockVirtualOrgService.testOfficelyPostHogSetup.mockResolvedValue({
      companyId: "company-1",
      enabled: true,
      projectId: "12345",
      baseUrl: "https://us.posthog.com",
      eventCount: 42,
      activeUserTotal: 18,
      onboardingEvent: "user onboarded",
      onboardingEventCount: 6,
      importantEvents: ["report created", "workflow completed"],
      importantEventCounts: [
        { eventName: "report created", count: 12 },
        { eventName: "workflow completed", count: 8 },
      ],
      usedSavedApiKey: true,
      checkedAt: "2026-04-03T00:00:00.000Z",
    });

    const res = await request(createApp())
      .post("/api/virtual-org/companies/company-1/officely/posthog/test")
      .send({
        enabled: true,
        projectId: "12345",
        onboardingEvent: "user onboarded",
        importantEvents: ["report created", "workflow completed"],
      });

    expect(res.status).toBe(200);
    expect(mockVirtualOrgService.testOfficelyPostHogSetup).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        enabled: true,
        projectId: "12345",
        onboardingEvent: "user onboarded",
        importantEvents: ["report created", "workflow completed"],
      }),
    );
  });
});
