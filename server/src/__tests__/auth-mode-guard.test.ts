import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import { actorMiddleware } from "../middleware/auth.js";
import { boardMutationGuard } from "../middleware/board-mutation-guard.js";
import { assertCompanyAccess } from "../routes/authz.js";
import { errorHandler } from "../middleware/error-handler.js";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";

const JWT_SECRET_ENV = "PAPERCLIP_AGENT_JWT_SECRET";

function makeMockDb(selects: Array<unknown[]> = []) {
  const selectQueue = [...selects];
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectQueue.shift() ?? []),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  };
}

function createApp(
  opts: {
    resolveSession?: (req: Request) => Promise<{ user: { id: string } } | null>;
    dbSelects?: Array<unknown[]>;
    companyId?: string;
  } = {},
) {
  const app = express();
  app.use(express.json());

  const db = makeMockDb(opts.dbSelects);
  app.use(
    actorMiddleware(db as any, {
      deploymentMode: "authenticated",
      resolveSession: opts.resolveSession as any,
    }),
  );
  app.use(boardMutationGuard());

  const companyId = opts.companyId ?? "co-1";
  app.post("/mutate", (req, res, next) => {
    try {
      assertCompanyAccess(req, companyId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);
  return app;
}

describe("actorMiddleware + boardMutationGuard in authenticated mode", () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env[JWT_SECRET_ENV];
    process.env[JWT_SECRET_ENV] = "test-jwt-secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env[JWT_SECRET_ENV];
    } else {
      process.env[JWT_SECRET_ENV] = originalSecret;
    }
  });

  it("no bearer, no session → mutation returns 401", async () => {
    const app = createApp({ resolveSession: async () => null });
    const res = await request(app).post("/mutate").send({});
    expect(res.status).toBe(401);
  });

  it("valid agent bearer → actor resolves, company access passes", async () => {
    const token = createLocalAgentJwt("agent-1", "co-1", "claude_local", "run-1");
    expect(token).toBeTruthy();
    const app = createApp({
      dbSelects: [
        [], // agentApiKeys lookup → no matching key
        [{ id: "agent-1", companyId: "co-1", status: "active" }], // agents lookup → found
      ],
    });
    const res = await request(app)
      .post("/mutate")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(204);
  });

  it("valid session with matching companyIds → actor resolves, passes", async () => {
    const app = createApp({
      resolveSession: async () => ({ user: { id: "user-1" } }),
      dbSelects: [
        [], // instanceUserRoles → not an instance admin
        [{ companyId: "co-1" }], // companyMemberships → active member of co-1
      ],
    });
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "http://localhost:3100")
      .send({});
    expect(res.status).toBe(204);
  });

  it("session user accessing company not in companyIds → 403", async () => {
    const app = createApp({
      resolveSession: async () => ({ user: { id: "user-1" } }),
      dbSelects: [
        [], // instanceUserRoles → not an instance admin
        [{ companyId: "co-1" }], // companyMemberships → member of co-1 only
      ],
      companyId: "co-2", // route resource belongs to co-2
    });
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "http://localhost:3100")
      .send({});
    expect(res.status).toBe(403);
  });
});
