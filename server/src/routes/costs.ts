import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createCostEventSchema, updateBudgetSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { costService, companyService, agentService, logActivity } from "../services/index.js";
import { verticalBudgetService } from "../services/vertical-budget.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function costRoutes(db: Db) {
  const router = Router();
  const costs = costService(db);
  const companies = companyService(db);
  const agents = agentService(db);
  const vbs = verticalBudgetService(db);

  router.post("/companies/:companyId/cost-events", validate(createCostEventSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== req.body.agentId) {
      res.status(403).json({ error: "Agent can only report its own costs" });
      return;
    }

    const event = await costs.createEvent(companyId, {
      ...req.body,
      occurredAt: new Date(req.body.occurredAt),
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "cost.reported",
      entityType: "cost_event",
      entityId: event.id,
      details: { costCents: event.costCents, model: event.model },
    });

    res.status(201).json(event);
  });

  function parseDateRange(query: Record<string, unknown>) {
    const from = query.from ? new Date(query.from as string) : undefined;
    const to = query.to ? new Date(query.to as string) : undefined;
    return (from || to) ? { from, to } : undefined;
  }

  router.get("/companies/:companyId/costs/summary", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const summary = await costs.summary(companyId, range);
    res.json(summary);
  });

  router.get("/companies/:companyId/costs/by-agent", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const rows = await costs.byAgent(companyId, range);
    res.json(rows);
  });

  router.get("/companies/:companyId/costs/by-project", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const rows = await costs.byProject(companyId, range);
    res.json(rows);
  });

  router.patch("/companies/:companyId/budgets", validate(updateBudgetSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const company = await companies.update(companyId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.budget_updated",
      entityType: "company",
      entityId: companyId,
      details: { budgetMonthlyCents: req.body.budgetMonthlyCents },
    });

    res.json(company);
  });

  router.patch("/agents/:agentId/budgets", validate(updateBudgetSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    if (req.actor.type === "agent") {
      if (req.actor.agentId !== agentId) {
        const actorAgent = await agents.getById(req.actor.agentId!);
        if (actorAgent?.role !== "cfo" && actorAgent?.name !== "VP Finance") {
          res.status(403).json({ error: "Only self or VP Finance can change agent budgets" });
          return;
        }
      }
    }

    const updated = await agents.update(agentId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent.budget_updated",
      entityType: "agent",
      entityId: updated.id,
      details: { budgetMonthlyCents: updated.budgetMonthlyCents },
    });

    res.json(updated);
  });

  // Vertical budget endpoints

  router.get("/companies/:companyId/verticals/budgets", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summaries = await vbs.getAllVerticalBudgets(companyId);
    res.json(summaries);
  });

  router.get("/agents/:agentId/vertical-budget", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const vp = await vbs.getVerticalHead(agentId);
    if (!vp) {
      res.status(404).json({ error: "No vertical head found for this agent" });
      return;
    }

    const budget = await vbs.computeVerticalBudget(vp.id);
    if (!budget) {
      res.status(404).json({ error: "Could not compute vertical budget" });
      return;
    }
    res.json(budget);
  });

  router.post("/agents/:agentId/budget-reload", async (req, res) => {
    const agentId = req.params.agentId as string;
    const { reloadCents } = req.body as { reloadCents?: number };
    if (typeof reloadCents !== "number" || reloadCents <= 0) {
      res.status(400).json({ error: "reloadCents must be a positive number" });
      return;
    }

    // Restrict to board users or CFO-role agents
    if (req.actor.type === "agent") {
      const actorAgent = await agents.getById(req.actor.agentId!);
      if (actorAgent?.role !== "cfo" && actorAgent?.name !== "VP Finance") {
        res.status(403).json({ error: "Only VP Finance or board users can reload budgets" });
        return;
      }
    }

    const updated = await vbs.executeReload(agentId, reloadCents);
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent.budget_reloaded",
      entityType: "agent",
      entityId: updated.id,
      details: { reloadCents, newBudgetMonthlyCents: updated.budgetMonthlyCents },
    });

    res.json(updated);
  });

  return router;
}
