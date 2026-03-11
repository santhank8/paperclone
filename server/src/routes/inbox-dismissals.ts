import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { createInboxDismissalSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { inboxDismissalService, logActivity } from "../services/index.js";
import { forbidden } from "../errors.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function inboxDismissalRoutes(db: Db) {
  const router = Router();
  const svc = inboxDismissalService(db);

  function requireBoardUserId(req: Request) {
    assertBoard(req);
    const userId = req.actor.userId?.trim();
    if (!userId) throw forbidden("Board user context required");
    return userId;
  }

  router.get("/companies/:companyId/inbox-dismissals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req);
    res.json(await svc.listActive(companyId, userId));
  });

  router.post(
    "/companies/:companyId/inbox-dismissals",
    validate(createInboxDismissalSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = requireBoardUserId(req);
      const row = await svc.dismiss(companyId, userId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "inbox.dismissed",
        entityType: "company",
        entityId: companyId,
        details: {
          kind: row.kind,
          targetId: row.targetId,
          fingerprint: row.fingerprint,
        },
      });
      res.status(201).json(row);
    },
  );

  router.delete("/companies/:companyId/inbox-dismissals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = requireBoardUserId(req);
    const count = await svc.clear(companyId, userId);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "inbox.dismissals_cleared",
      entityType: "company",
      entityId: companyId,
      details: { count },
    });
    res.json({ ok: true, count });
  });

  return router;
}
