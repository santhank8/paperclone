import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { artifactService } from "../services/artifacts.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../services/activity-log.js";
import { badRequest } from "../errors.js";

export function artifactRoutes(db: Db) {
  const router = Router();
  const service = artifactService(db);

  router.get("/companies/:companyId/artifacts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const filters: Record<string, string | undefined> = {
      agentId: req.query.agentId as string | undefined,
      issueId: req.query.issueId as string | undefined,
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
    };

    const rows = await service.list(companyId, filters);
    res.json(rows);
  });

  router.post("/companies/:companyId/artifacts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { type, name } = req.body;
    if (!type || !name) {
      throw badRequest("type and name are required");
    }

    const artifact = await service.create(companyId, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "artifact.created",
      entityType: "artifact",
      entityId: artifact.id,
      details: { type: artifact.type, name: artifact.name },
    });

    res.status(201).json(artifact);
  });

  router.get("/artifacts/:id", async (req, res) => {
    const artifact = await service.getById(req.params.id as string);
    assertCompanyAccess(req, artifact.companyId);
    res.json(artifact);
  });

  router.patch("/artifacts/:id", async (req, res) => {
    const existing = await service.getById(req.params.id as string);
    assertCompanyAccess(req, existing.companyId);

    const updated = await service.update(req.params.id as string, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "artifact.updated",
      entityType: "artifact",
      entityId: existing.id,
      details: { name: updated.name, status: updated.status },
    });

    res.json(updated);
  });

  router.post("/artifacts/:id/archive", async (req, res) => {
    const existing = await service.getById(req.params.id as string);
    assertCompanyAccess(req, existing.companyId);

    const archived = await service.archive(req.params.id as string);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "artifact.archived",
      entityType: "artifact",
      entityId: existing.id,
      details: { name: existing.name },
    });

    res.json(archived);
  });

  return router;
}
