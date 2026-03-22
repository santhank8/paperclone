import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { instanceLocaleRoutes } from "../routes/instance-locales.js";

const mockInstanceLocalesService = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upsert: vi.fn(),
  listCompanyIds: vi.fn(),
}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  instanceLocalesService: () => mockInstanceLocalesService,
  logActivity: mockLogActivity,
}));

function createApp(actor: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", instanceLocaleRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("instance locale routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstanceLocalesService.list.mockResolvedValue({
      defaultLocale: "en",
      locales: [
        { locale: "en", label: "English", builtIn: true },
        { locale: "zh-CN", label: "简体中文", builtIn: false },
      ],
    });
    mockInstanceLocalesService.get.mockResolvedValue({
      schemaVersion: 1,
      locale: "zh-CN",
      label: "简体中文",
      baseLocale: "en",
      messages: {
        "common.loading": "加载中...",
      },
    });
    mockInstanceLocalesService.upsert.mockResolvedValue({
      changed: true,
      pack: {
        schemaVersion: 1,
        locale: "zh-CN",
        label: "简体中文",
        baseLocale: "en",
        messages: {
          "common.loading": "加载中...",
        },
      },
    });
    mockInstanceLocalesService.listCompanyIds.mockResolvedValue(["company-1", "company-2"]);
  });

  it("allows board users to read locale summaries and packs", async () => {
    const app = createApp({
      type: "board",
      userId: "user-1",
      source: "session",
      isInstanceAdmin: false,
      companyIds: ["company-1"],
    });

    const listRes = await request(app).get("/api/instance/locales");
    expect(listRes.status).toBe(200);
    expect(listRes.body.defaultLocale).toBe("en");

    const getRes = await request(app).get("/api/instance/locales/zh-CN");
    expect(getRes.status).toBe(200);
    expect(getRes.body.locale).toBe("zh-CN");
  });

  it("allows instance admins to upsert locale packs", async () => {
    const app = createApp({
      type: "board",
      userId: "admin-1",
      source: "session",
      isInstanceAdmin: true,
      companyIds: ["company-1"],
    });

    const res = await request(app)
      .put("/api/instance/locales/zh-CN")
      .send({
        schemaVersion: 1,
        locale: "zh-CN",
        label: "简体中文",
        baseLocale: "en",
        messages: {
          "common.loading": "加载中...",
        },
      });

    expect(res.status).toBe(200);
    expect(mockInstanceLocalesService.upsert).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledTimes(2);
  });

  it("skips activity logs when locale pack content is unchanged", async () => {
    mockInstanceLocalesService.upsert.mockResolvedValueOnce({
      changed: false,
      pack: {
        schemaVersion: 1,
        locale: "zh-CN",
        label: "简体中文",
        baseLocale: "en",
        messages: {
          "common.loading": "加载中...",
        },
      },
    });

    const app = createApp({
      type: "board",
      userId: "admin-1",
      source: "session",
      isInstanceAdmin: true,
      companyIds: ["company-1"],
    });

    const res = await request(app)
      .put("/api/instance/locales/zh-CN")
      .send({
        schemaVersion: 1,
        locale: "zh-CN",
        label: "简体中文",
        baseLocale: "en",
        messages: {
          "common.loading": "加载中...",
        },
      });

    expect(res.status).toBe(200);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("rejects locale path/body mismatches", async () => {
    const app = createApp({
      type: "board",
      userId: "admin-1",
      source: "session",
      isInstanceAdmin: true,
      companyIds: ["company-1"],
    });

    const res = await request(app)
      .put("/api/instance/locales/zh-CN")
      .send({
        schemaVersion: 1,
        locale: "ja-JP",
        label: "日本語",
        baseLocale: "en",
        messages: {},
      });

    expect(res.status).toBe(400);
    expect(mockInstanceLocalesService.upsert).not.toHaveBeenCalled();
  });

  it("rejects non-admin writes", async () => {
    const app = createApp({
      type: "board",
      userId: "user-1",
      source: "session",
      isInstanceAdmin: false,
      companyIds: ["company-1"],
    });

    const res = await request(app)
      .put("/api/instance/locales/zh-CN")
      .send({
        schemaVersion: 1,
        locale: "zh-CN",
        label: "简体中文",
        baseLocale: "en",
        messages: {},
      });

    expect(res.status).toBe(403);
    expect(mockInstanceLocalesService.upsert).not.toHaveBeenCalled();
  });

  it("rejects agent callers", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "agent_key",
    });

    const res = await request(app).get("/api/instance/locales");
    expect(res.status).toBe(403);
  });
});
