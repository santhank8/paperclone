import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { platformCapabilitiesRoutes } from "../routes/platform-capabilities.js";

describe("GET /platform/capabilities", () => {
  it("returns core domains and adapter list for local_trusted (implicit board)", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { actor: unknown }).actor = {
        type: "board",
        userId: "local-board",
        source: "local_implicit",
      };
      next();
    });
    app.use(
      platformCapabilitiesRoutes({
        deploymentMode: "local_trusted",
        deploymentExposure: "private",
        authReady: true,
        companyDeletionEnabled: true,
      }),
    );

    const res = await request(app).get("/platform/capabilities").expect(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(Array.isArray(res.body.core)).toBe(true);
    expect(res.body.core.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.installedAgentAdapters)).toBe(true);
    const types = res.body.installedAgentAdapters.map((a: { type: string }) => a.type);
    expect(types).toContain("process");
    expect(types).toContain("claude_local");
  });

  it("returns 401 when unauthenticated in authenticated mode", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { actor: unknown }).actor = { type: "none", source: "none" };
      next();
    });
    app.use(
      platformCapabilitiesRoutes({
        deploymentMode: "authenticated",
        deploymentExposure: "private",
        authReady: true,
        companyDeletionEnabled: true,
      }),
    );

    await request(app).get("/platform/capabilities").expect(401);
  });
});
