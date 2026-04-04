import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginRoutes } from "../routes/plugins.js";
import { errorHandler } from "../middleware/index.js";

const pluginId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const mockRegistry = vi.hoisted(() => ({
  getById: vi.fn(),
  getByKey: vi.fn(),
}));

const mockLifecycle = vi.hoisted(() => ({}));

const mockWorkerManager = vi.hoisted(() => ({
  call: vi.fn(),
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockRegistry,
}));

vi.mock("../services/plugin-lifecycle.js", () => ({
  pluginLifecycleManager: () => mockLifecycle,
}));

vi.mock("../services/plugin-loader.js", () => ({
  getPluginUiContributionMetadata: vi.fn(),
  pluginLoader: vi.fn(),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

vi.mock("../services/live-events.js", () => ({
  publishGlobalLiveEvent: vi.fn(),
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", pluginRoutes(
    {} as any,
    {} as any,
    undefined,
    undefined,
    undefined,
    { workerManager: mockWorkerManager as any },
  ));
  app.use(errorHandler);
  return app;
}

describe("plugin bridge agent action routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.getById.mockResolvedValue({
      id: pluginId,
      pluginKey: "homio.atlas-bridge",
      displayName: "Atlas Bridge",
      status: "ready",
    });
    mockRegistry.getByKey.mockResolvedValue(null);
    mockWorkerManager.call.mockResolvedValue({ ok: true });
  });

  it("allows agent-authenticated action calls when companyId is nested in params", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId,
      source: "agent_jwt",
    });

    const res = await request(app)
      .post(`/api/plugins/${pluginId}/actions/atlas-bridge-sync-issue-projection`)
      .send({
        params: {
          companyId,
          issueId: "issue-1",
          reason: "test",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { ok: true },
    });
    expect(mockWorkerManager.call).toHaveBeenCalledWith(
      pluginId,
      "performAction",
      {
        key: "atlas-bridge-sync-issue-projection",
        params: {
          companyId,
          issueId: "issue-1",
          reason: "test",
        },
        renderEnvironment: null,
      },
    );
  });

  it("rejects agent-authenticated action calls without company scope", async () => {
    const app = createApp({
      type: "agent",
      agentId: "agent-1",
      companyId,
      source: "agent_jwt",
    });

    const res = await request(app)
      .post(`/api/plugins/${pluginId}/actions/atlas-bridge-sync-issue-projection`)
      .send({
        params: {
          issueId: "issue-1",
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("companyId is required for agent plugin bridge access");
  });

  it("keeps board-authenticated action calls working without company scope", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await request(app)
      .post(`/api/plugins/${pluginId}/actions/atlas-bridge-sync-issue-projection`)
      .send({
        params: {
          issueId: "issue-1",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { ok: true },
    });
  });
});
