import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createWebhookConfigSchema,
  updateWebhookConfigSchema,
  createWebhookActionRuleSchema,
  updateWebhookActionRuleSchema,
  createWebhookIssueLinkSchema,
} from "@paperclipai/shared";
import { eq } from "drizzle-orm";
import { issues } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { logActivity, webhookService } from "../services/index.js";

export function webhookRoutes(db: Db) {
  const router = Router();
  const svc = webhookService(db);

  // List webhook configs for a company
  router.get("/companies/:companyId/webhooks", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const configs = await svc.listConfigs(companyId);
    res.json(configs);
  });

  // Create webhook config
  router.post(
    "/companies/:companyId/webhooks",
    validate(createWebhookConfigSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const created = await svc.createConfig(companyId, req.body);

      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "webhook.created",
        entityType: "webhook",
        entityId: created.id,
        details: { name: created.name },
      });

      res.status(201).json(created);
    },
  );

  // Get single webhook config
  router.get("/webhooks/:id", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const config = await svc.getConfigById(id);
    if (!config) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, config.companyId);
    res.json(config);
  });

  // Update webhook config
  router.patch("/webhooks/:id", validate(updateWebhookConfigSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getConfigById(id);
    if (!existing) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const updated = await svc.updateConfig(id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }

    await logActivity(db, {
      companyId: updated.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "webhook.updated",
      entityType: "webhook",
      entityId: updated.id,
      details: { name: updated.name },
    });

    res.json(updated);
  });

  // Delete webhook config
  router.delete("/webhooks/:id", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getConfigById(id);
    if (!existing) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const removed = await svc.removeConfig(id);
    if (!removed) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }

    await logActivity(db, {
      companyId: removed.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "webhook.deleted",
      entityType: "webhook",
      entityId: removed.id,
      details: { name: removed.name },
    });

    res.json({ ok: true });
  });

  // Regenerate token
  router.post("/webhooks/:id/regenerate-token", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getConfigById(id);
    if (!existing) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const updated = await svc.regenerateToken(id);
    if (!updated) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }

    await logActivity(db, {
      companyId: updated.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "webhook.token_regenerated",
      entityType: "webhook",
      entityId: updated.id,
      details: { name: updated.name },
    });

    res.json(updated);
  });

  // List rules for a webhook config
  router.get("/webhooks/:id/rules", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const config = await svc.getConfigById(id);
    if (!config) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, config.companyId);
    const rules = await svc.listRules(id);
    res.json(rules);
  });

  // Create rule
  router.post(
    "/webhooks/:id/rules",
    validate(createWebhookActionRuleSchema),
    async (req, res) => {
      assertBoard(req);
      const id = req.params.id as string;
      const config = await svc.getConfigById(id);
      if (!config) {
        res.status(404).json({ error: "Webhook config not found" });
        return;
      }
      assertCompanyAccess(req, config.companyId);

      const created = await svc.createRule(id, req.body);

      await logActivity(db, {
        companyId: config.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "webhook_rule.created",
        entityType: "webhook_rule",
        entityId: created.id,
        details: { eventType: created.eventType, action: created.action },
      });

      res.status(201).json(created);
    },
  );

  // Update rule
  router.patch("/webhook-rules/:ruleId", validate(updateWebhookActionRuleSchema), async (req, res) => {
    assertBoard(req);
    const ruleId = req.params.ruleId as string;
    const existing = await svc.getRuleById(ruleId);
    if (!existing) {
      res.status(404).json({ error: "Webhook rule not found" });
      return;
    }
    const config = await svc.getConfigById(existing.webhookConfigId);
    if (!config) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, config.companyId);

    const updated = await svc.updateRule(ruleId, req.body);
    if (!updated) {
      res.status(404).json({ error: "Webhook rule not found" });
      return;
    }

    await logActivity(db, {
      companyId: config.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "webhook_rule.updated",
      entityType: "webhook_rule",
      entityId: updated.id,
      details: { eventType: updated.eventType, action: updated.action },
    });

    res.json(updated);
  });

  // Delete rule
  router.delete("/webhook-rules/:ruleId", async (req, res) => {
    assertBoard(req);
    const ruleId = req.params.ruleId as string;
    const existing = await svc.getRuleById(ruleId);
    if (!existing) {
      res.status(404).json({ error: "Webhook rule not found" });
      return;
    }
    const config = await svc.getConfigById(existing.webhookConfigId);
    if (!config) {
      res.status(404).json({ error: "Webhook config not found" });
      return;
    }
    assertCompanyAccess(req, config.companyId);

    const removed = await svc.removeRule(ruleId);
    if (!removed) {
      res.status(404).json({ error: "Webhook rule not found" });
      return;
    }

    await logActivity(db, {
      companyId: config.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "webhook_rule.deleted",
      entityType: "webhook_rule",
      entityId: removed.id,
      details: { eventType: removed.eventType, action: removed.action },
    });

    res.json({ ok: true });
  });

  // List event log for a company
  router.get("/companies/:companyId/webhook-events", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const events = await svc.listEvents(companyId, Math.min(limit, 500));
    res.json(events);
  });

  // List issue links
  router.get("/issues/:issueId/webhook-links", async (req, res) => {
    assertBoard(req);
    const issueId = req.params.issueId as string;
    const links = await svc.listIssueLinks(issueId);
    res.json(links);
  });

  // Create issue link
  router.post(
    "/issues/:issueId/webhook-links",
    validate(createWebhookIssueLinkSchema),
    async (req, res) => {
      assertBoard(req);
      const issueId = req.params.issueId as string;
      const issue = await db
        .select({ id: issues.id, companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, issueId))
        .then((rows) => rows[0] ?? null);
      if (!issue) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }
      assertCompanyAccess(req, issue.companyId);

      const created = await svc.createIssueLink(issue.companyId, issueId, req.body);
      res.status(201).json(created);
    },
  );

  // Delete issue link
  router.delete("/webhook-links/:linkId", async (req, res) => {
    assertBoard(req);
    const linkId = req.params.linkId as string;
    const existing = await svc.getIssueLinkById(linkId);
    if (!existing) {
      res.status(404).json({ error: "Webhook link not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const removed = await svc.removeIssueLink(linkId);
    if (!removed) {
      res.status(404).json({ error: "Webhook link not found" });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
