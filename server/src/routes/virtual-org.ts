import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  clarifyVirtualOrgInboxItemSchema,
  createVirtualOrgInboxItemSchema,
  officelyInternalDatabaseSetupSchema,
  upsertVirtualOrgCompanyProfileSchema,
} from "@paperclipai/virtual-org-types";
import { validate } from "../middleware/validate.js";
import { virtualOrgService } from "../services/virtual-org.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function virtualOrgRoutes(db: Db) {
  const router = Router();
  const svc = virtualOrgService(db);

  router.get("/virtual-org/portfolio", async (req, res) => {
    assertBoard(req);
    res.json(await svc.portfolio());
  });

  router.post("/virtual-org/bootstrap-defaults", async (req, res) => {
    assertBoard(req);
    res.status(201).json(await svc.bootstrapDefaults());
  });

  router.get("/virtual-org/companies/:companyId/workspace", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.workspace(companyId));
  });

  router.get("/virtual-org/companies/:companyId/profile", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.getProfile(companyId));
  });

  router.put(
    "/virtual-org/companies/:companyId/profile",
    validate(upsertVirtualOrgCompanyProfileSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.upsertProfile(companyId, req.body));
    },
  );

  router.get("/virtual-org/companies/:companyId/inbox", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listInbox(companyId));
  });

  router.post("/virtual-org/companies/:companyId/officely/sync-v1", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.syncOfficelyV1(companyId));
  });

  router.post(
    "/virtual-org/companies/:companyId/officely/internal-database/setup",
    validate(officelyInternalDatabaseSetupSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.saveOfficelyInternalDatabaseSetup(companyId, req.body));
    },
  );

  router.post(
    "/virtual-org/companies/:companyId/officely/internal-database/test",
    validate(officelyInternalDatabaseSetupSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await svc.testOfficelyInternalDatabaseSetup(companyId, req.body));
    },
  );

  router.post("/virtual-org/inbox", validate(createVirtualOrgInboxItemSchema), async (req, res) => {
    assertBoard(req);
    res.status(201).json(await svc.createInboxItem(req.body));
  });

  router.post(
    "/virtual-org/inbox/:itemId/clarify",
    validate(clarifyVirtualOrgInboxItemSchema),
    async (req, res) => {
      assertBoard(req);
      res.json(await svc.clarifyInboxItem(req.params.itemId as string, req.body.companyId, req.body.clarificationReply));
    },
  );

  return router;
}
