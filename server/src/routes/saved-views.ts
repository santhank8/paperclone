import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { savedViewService } from "../services/saved-views.js";
import { assertCompanyAccess } from "./authz.js";

export function savedViewRoutes(db: Db) {
  const router = Router();
  const svc = savedViewService(db);

  router.get("/companies/:companyId/saved-views", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const views = await svc.list(companyId);
    res.json(views);
  });

  router.post("/companies/:companyId/saved-views", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const { name, filters, groupBy, sortField, sortDirection } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const view = await svc.create(companyId, {
      name,
      filters: filters ?? { statuses: [], priorities: [], assignees: [], labels: [] },
      groupBy: groupBy ?? "none",
      sortField: sortField ?? "updated",
      sortDirection: sortDirection ?? "desc",
    });
    res.status(201).json(view);
  });

  router.patch("/companies/:companyId/saved-views/:viewId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const viewId = req.params.viewId as string;
    assertCompanyAccess(req, companyId);
    const { name, filters, groupBy, sortField, sortDirection } = req.body;
    const view = await svc.update(viewId, companyId, {
      name,
      filters,
      groupBy,
      sortField,
      sortDirection,
    });
    res.json(view);
  });

  router.delete("/companies/:companyId/saved-views/:viewId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const viewId = req.params.viewId as string;
    assertCompanyAccess(req, companyId);
    await svc.remove(viewId, companyId);
    res.json({ ok: true });
  });

  return router;
}
