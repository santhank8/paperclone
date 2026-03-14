import { Router, type Response } from "express";
import type { Db } from "@paperclipai/db";
import { addChatMessageSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { chatService } from "../services/chat.js";
import { agentService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function chatRoutes(db: Db) {
  const router = Router();
  const chat = chatService(db);
  const agents = agentService(db);

  router.get("/agents/:agentId/chat/messages", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    assertCompanyAccess(req, agent.companyId);
    const messages = await chat.listMessages(agent.id);
    res.json(messages);
  });

  router.post("/agents/:agentId/chat/messages", validate(addChatMessageSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    assertCompanyAccess(req, agent.companyId);
    const actor = getActorInfo(req);
    const result = await chat.createMessage({
      agentId: agent.id,
      content: req.body.content,
      actor: {
        actorType: actor.actorType,
        actorId: actor.actorId,
      },
    });

    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "chat.message.sent",
      entityType: "agent",
      entityId: agent.id,
      details: {
        chatMessageId: result.message.id,
        runId: result.runId,
      },
    });

    res.status(201).json(result);
  });

  router.get("/agents/:agentId/chat/messages/:messageId/stream", async (req, res) => {
    const agentId = req.params.agentId as string;
    const messageId = req.params.messageId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    assertCompanyAccess(req, agent.companyId);

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      await chat.streamMessageResponse({
        agentId: agent.id,
        messageId,
        isClosed: () => closed,
        onReady: ({ runId }) => writeSseEvent(res, "ready", { runId }),
        onLog: (chunk) => writeSseEvent(res, "log", chunk),
        onComplete: ({ runId, status, message }) =>
          writeSseEvent(res, "completed", {
            runId,
            status,
            message,
          }),
      });
    } catch (error) {
      writeSseEvent(res, "error", {
        error: error instanceof Error ? error.message : "Chat stream failed",
      });
    } finally {
      res.end();
    }
  });

  return router;
}
