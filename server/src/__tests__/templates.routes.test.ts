import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { templateRoutes } from "../routes/templates.js";

const templatesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../templates",
);

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      isInstanceAdmin: true,
      source: "local_implicit",
    };
    next();
  });
  app.use("/templates", templateRoutes({ templatesRoot }));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

describe("template routes", () => {
  it("lists built-in templates", async () => {
    const res = await request(buildApp()).get("/templates");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "solo-founder-lite",
          name: "Solo Founder Lite",
        }),
      ]),
    );
  });

  it("returns built-in template detail", async () => {
    const res = await request(buildApp()).get("/templates/solo-founder-lite");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: "solo-founder-lite",
        manifest: expect.objectContaining({
          includes: {
            company: true,
            agents: true,
          },
        }),
      }),
    );
  });
});
