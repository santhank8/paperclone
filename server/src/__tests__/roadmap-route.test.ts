import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { roadmapRoutes } from "../routes/roadmap.js";

function createApp(actor: Record<string, unknown>, repoRoot: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", roadmapRoutes({ repoRoot }));
  app.use(errorHandler);
  return app;
}

describe("roadmap route", () => {
  let repoRoot = "";

  beforeEach(async () => {
    repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-roadmap-"));
    await fs.mkdir(path.join(repoRoot, "doc", "plans"), { recursive: true });
    await fs.writeFile(
      path.join(repoRoot, "doc", "ROADMAP.md"),
      [
        "# Roadmap",
        "",
        "Canonical roadmap source:",
        "",
        "- [2026 Q2 CEO Roadmap](./plans/2026-q2-roadmap.md)",
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(
      path.join(repoRoot, "doc", "plans", "2026-q2-roadmap.md"),
      [
        "# 2026 Q2 CEO Roadmap",
        "",
        "Status: Active",
        "Owner: CEO",
        "Last Updated: 2026-04-11",
        "",
        "## Contract",
        "1. Tickets must map to a roadmap item.",
        "",
        "## Now",
        "### RM-2026-Q2-01 First success",
        "- Outcome: A user reaches success quickly.",
        "- Status: Planned",
      ].join("\n"),
      "utf8",
    );
  });

  afterEach(async () => {
    if (repoRoot) {
      await fs.rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns parsed roadmap data for board users", async () => {
    const app = createApp(
      { type: "board", source: "local_implicit", userId: "board-user-1" },
      repoRoot,
    );

    const response = await request(app).get("/api/roadmap");
    expect(response.status).toBe(200);
    expect(response.body.roadmap.title).toBe("2026 Q2 CEO Roadmap");
    expect(response.body.roadmap.owner).toBe("CEO");
    expect(response.body.roadmap.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Now",
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "RM-2026-Q2-01",
              title: "First success",
            }),
          ]),
        }),
      ]),
    );
  });

  it("rejects non-board actors without company scope", async () => {
    const app = createApp(
      {
        type: "agent",
        source: "agent_key",
        agentId: "agent-1",
        companyId: "company-1",
      },
      repoRoot,
    );

    const response = await request(app).get("/api/roadmap");
    expect(response.status).toBe(403);
  });

  it("allows company-scoped roadmap reads for agent keys with matching company access", async () => {
    const app = createApp(
      {
        type: "agent",
        source: "agent_key",
        agentId: "agent-1",
        companyId: "company-1",
      },
      repoRoot,
    );

    const response = await request(app).get("/api/roadmap").query({ companyId: "company-1" });
    expect(response.status).toBe(200);
    expect(response.body.roadmap.title).toBe("2026 Q2 CEO Roadmap");
  });

  it("renames a roadmap item title in the canonical markdown source", async () => {
    const app = createApp(
      { type: "board", source: "local_implicit", userId: "board-user-1" },
      repoRoot,
    );

    const response = await request(app)
      .patch("/api/roadmap/items/RM-2026-Q2-01")
      .send({ title: "Faster first success" });

    expect(response.status).toBe(200);
    expect(response.body.item).toEqual(
      expect.objectContaining({
        id: "RM-2026-Q2-01",
        title: "Faster first success",
      }),
    );

    const updated = await fs.readFile(path.join(repoRoot, "doc", "plans", "2026-q2-roadmap.md"), "utf8");
    expect(updated).toContain("### RM-2026-Q2-01 Faster first success");
    expect(updated).not.toContain("### RM-2026-Q2-01 First success");
  });

  it("rejects company-scoped roadmap reads for agent keys on other companies", async () => {
    const app = createApp(
      {
        type: "agent",
        source: "agent_key",
        agentId: "agent-1",
        companyId: "company-1",
      },
      repoRoot,
    );

    const response = await request(app).get("/api/roadmap").query({ companyId: "company-2" });
    expect(response.status).toBe(403);
  });
});
