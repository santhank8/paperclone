import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { canonicalizeLocaleCode, localizationPackSchema } from "@paperclipai/shared";
import { badRequest, forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { instanceLocalesService, logActivity } from "../services/index.js";
import { assertBoard, getActorInfo } from "./authz.js";

function assertCanManageInstanceLocales(req: Request) {
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function instanceLocaleRoutes(db: Db) {
  const router = Router();
  const svc = instanceLocalesService(db);

  router.get("/instance/locales", async (req, res) => {
    assertBoard(req);
    res.json(await svc.list());
  });

  router.get("/instance/locales/:locale", async (req, res) => {
    assertBoard(req);
    res.json(await svc.get(req.params.locale));
  });

  router.put(
    "/instance/locales/:locale",
    validate(localizationPackSchema),
    async (req, res) => {
      assertCanManageInstanceLocales(req);
      const locale = canonicalizeLocaleCode(String(req.params.locale));
      if (locale !== canonicalizeLocaleCode(req.body.locale)) {
        throw badRequest("Locale path must match request body locale");
      }
      const result = await svc.upsert(req.body);
      if (result.changed) {
        const actor = getActorInfo(req);
        const companyIds = await svc.listCompanyIds();
        await Promise.all(
          companyIds.map((companyId) =>
            logActivity(db, {
              companyId,
              actorType: actor.actorType,
              actorId: actor.actorId,
              agentId: actor.agentId,
              runId: actor.runId,
              action: "instance.locale_pack_upserted",
              entityType: "instance_locale_pack",
              entityId: result.pack.locale,
              details: {
                locale: result.pack.locale,
                label: result.pack.label,
                messageCount: Object.keys(result.pack.messages).length,
              },
            }),
          ),
        );
      }
      res.json(result.pack);
    },
  );

  return router;
}
