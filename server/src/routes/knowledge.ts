import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createKnowledgeService } from "../services/knowledge.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function knowledgeRoutes(db: Db) {
  const router = Router();
  const svc = createKnowledgeService(db);

  /** Create a knowledge entry */
  router.post("/knowledge", async (req, res, next) => {
    try {
      const actor = getActorInfo(req);
      const { title, body, ...rest } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: "title and body are required" });
      }
      if (rest.companyId) {
        assertCompanyAccess(req, rest.companyId);
      }
      const entry = await svc.create({
        title,
        body,
        ...rest,
        sourceAgentId: rest.sourceAgentId ?? (actor.agentId || undefined),
      });
      return res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  });

  /** Search knowledge (full-text) */
  router.get("/knowledge/search", async (req, res, next) => {
    try {
      getActorInfo(req); // ensure authenticated
      const {
        q,
        company_id,
        category,
        project_id,
        limit,
        offset,
        min_relevance,
        max_age_days,
        summary,
      } = req.query;

      if (company_id) {
        assertCompanyAccess(req, String(company_id));
      }

      const input = {
        query: String(q ?? ""),
        companyId: company_id ? String(company_id) : undefined,
        category: category ? String(category) : undefined,
        projectId: project_id ? String(project_id) : undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
        minRelevance: min_relevance ? Number(min_relevance) : undefined,
        maxAgeDays: max_age_days ? Number(max_age_days) : undefined,
      };

      const results =
        summary === "true"
          ? await svc.searchSummary(input)
          : await svc.search(input);

      return res.json({ results, count: results.length });
    } catch (err) {
      next(err);
    }
  });

  /** Weekly brain digest */
  router.get("/knowledge/weekly-digest", async (req, res, next) => {
    try {
      getActorInfo(req);
      const digest = await svc.getWeeklyDigest();
      return res.json(digest);
    } catch (err) {
      next(err);
    }
  });

  /** Get knowledge stats — MUST be before :id route */
  router.get("/knowledge/stats", async (req, res, next) => {
    try {
      getActorInfo(req);
      const stats = await svc.getStats();
      return res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  /** Bulk import entries — MUST be before :id route */
  router.post("/knowledge/bulk-import", async (req, res, next) => {
    try {
      getActorInfo(req);
      const { entries } = req.body;
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: "entries array required" });
      }
      if (entries.length > 100) {
        return res.status(400).json({ error: "Maximum 100 entries per request" });
      }
      // Validate company access for each unique companyId in entries
      const uniqueCompanyIds = [...new Set(
        entries.map((e: { companyId?: string }) => e.companyId).filter(Boolean),
      )] as string[];
      for (const cid of uniqueCompanyIds) {
        assertCompanyAccess(req, cid);
      }
      const result = await svc.bulkImport(entries);
      return res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** Get single entry (progressive disclosure - full body) */
  router.get("/knowledge/:id", async (req, res, next) => {
    try {
      getActorInfo(req);
      const entry = await svc.getById(req.params.id);
      if (!entry) return res.status(404).json({ error: "not found" });
      if (entry.companyId) {
        assertCompanyAccess(req, entry.companyId);
      }
      return res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  /** Bump access count + relevance */
  router.post("/knowledge/:id/access", async (req, res, next) => {
    try {
      getActorInfo(req);
      const result = await svc.bumpAccess(req.params.id);
      if (!result) return res.status(404).json({ error: "not found" });
      return res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
