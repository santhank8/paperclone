import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { assertCompanyAccess } from "../routes/authz.js";
import { errorHandler } from "../middleware/error-handler.js";

function createApp(actor: Express.Request["actor"], targetCompanyId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.get("/resource", (req, res) => {
    assertCompanyAccess(req, targetCompanyId);
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("assertCompanyAccess", () => {
  it("denies unauthenticated (none) actor with 401", async () => {
    const actor: Express.Request["actor"] = { type: "none", source: "none" };
    const res = await request(createApp(actor, "co-1")).get("/resource");
    expect(res.status).toBe(401);
  });

  it("denies board session actor accessing a company not in their companyIds", async () => {
    const actor: Express.Request["actor"] = {
      type: "board",
      userId: "user-1",
      source: "session",
      companyIds: ["co-1"],
      isInstanceAdmin: false,
    };
    const res = await request(createApp(actor, "co-2")).get("/resource");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "User does not have access to this company" });
  });

  it("allows board session actor accessing a company in their companyIds", async () => {
    const actor: Express.Request["actor"] = {
      type: "board",
      userId: "user-1",
      source: "session",
      companyIds: ["co-1", "co-2"],
      isInstanceAdmin: false,
    };
    const res = await request(createApp(actor, "co-2")).get("/resource");
    expect(res.status).toBe(200);
  });

  it("allows instance admin board actor to access any company", async () => {
    const actor: Express.Request["actor"] = {
      type: "board",
      userId: "user-admin",
      source: "session",
      companyIds: ["co-1"],
      isInstanceAdmin: true,
    };
    const res = await request(createApp(actor, "co-999")).get("/resource");
    expect(res.status).toBe(200);
  });

  it("allows local_implicit board actor to access any company regardless of companyIds", async () => {
    const actor: Express.Request["actor"] = {
      type: "board",
      userId: "local-board",
      source: "local_implicit",
      companyIds: [],
      isInstanceAdmin: true,
    };
    const res = await request(createApp(actor, "co-any")).get("/resource");
    expect(res.status).toBe(200);
  });

  it("allows agent actor accessing its own company", async () => {
    const actor: Express.Request["actor"] = {
      type: "agent",
      agentId: "agent-1",
      companyId: "co-1",
      source: "agent_key",
    };
    const res = await request(createApp(actor, "co-1")).get("/resource");
    expect(res.status).toBe(200);
  });

  it("denies agent actor accessing a different company", async () => {
    const actor: Express.Request["actor"] = {
      type: "agent",
      agentId: "agent-1",
      companyId: "co-1",
      source: "agent_key",
    };
    const res = await request(createApp(actor, "co-2")).get("/resource");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Agent key cannot access another company" });
  });
});
