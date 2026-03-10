import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createAgentMemorySchema, updateAgentMemorySchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { agentMemoryService } from "../services/agent-memories.js";
import { agentService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function agentMemoryRoutes(db: Db) {
  const router = Router();
  const svc = agentMemoryService(db);
  const agentSvc = agentService(db);

  // List memories for an agent
  router.get("/agents/:agentId/memories", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agentSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const category = req.query.category as string | undefined;
    const result = await svc.list({
      companyId: agent.companyId,
      agentId,
      category,
    });
    res.json(result);
  });

  // List all memories across agents for a company (board view)
  router.get("/companies/:companyId/memories", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listForCompany(companyId);
    res.json(result);
  });

  // Get a single memory
  router.get("/memories/:memoryId", async (req, res) => {
    const memoryId = req.params.memoryId as string;
    const memory = await svc.getById(memoryId);
    if (!memory) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    assertCompanyAccess(req, memory.companyId);
    res.json(memory);
  });

  // Create / upsert a memory
  router.post("/agents/:agentId/memories", validate(createAgentMemorySchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agentSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const memory = await svc.upsert(agent.companyId, agentId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent_memory.saved",
      entityType: "agent_memory",
      entityId: memory.id,
      details: { category: memory.category, key: memory.key },
    });
    res.status(201).json(memory);
  });

  // Update a memory
  router.patch("/memories/:memoryId", validate(updateAgentMemorySchema), async (req, res) => {
    const memoryId = req.params.memoryId as string;
    const existing = await svc.getById(memoryId);
    if (!existing) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const memory = await svc.update(existing.id, req.body);
    if (!memory) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: memory.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent_memory.updated",
      entityType: "agent_memory",
      entityId: memory.id,
      details: req.body,
    });
    res.json(memory);
  });

  // Delete a memory
  router.delete("/memories/:memoryId", async (req, res) => {
    const memoryId = req.params.memoryId as string;
    const existing = await svc.getById(memoryId);
    if (!existing) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const memory = await svc.remove(existing.id);
    if (!memory) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: memory.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent_memory.deleted",
      entityType: "agent_memory",
      entityId: memory.id,
    });
    res.json(memory);
  });

  return router;
}
