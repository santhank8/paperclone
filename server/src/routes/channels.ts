import { Router } from "express";
import type { Db } from "@ironworksai/db";
import { agentChannels } from "@ironworksai/db";
import { eq } from "drizzle-orm";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { publishLiveEvent } from "../services/live-events.js";
import {
  ensureCompanyChannel,
  getMessages,
  listChannels,
  postMessage,
} from "../services/channels.js";

export function channelRoutes(db: Db) {
  const router = Router();

  // GET /api/companies/:companyId/channels
  router.get("/companies/:companyId/channels", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // Ensure at least the #company channel exists
    await ensureCompanyChannel(db, companyId);

    const channels = await listChannels(db, companyId);
    res.json(channels);
  });

  // GET /api/companies/:companyId/channels/:channelId/messages
  router.get("/companies/:companyId/channels/:channelId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    const channelId = req.params.channelId as string;
    assertCompanyAccess(req, companyId);

    // Verify the channel belongs to this company
    const channel = await db
      .select({ id: agentChannels.id })
      .from(agentChannels)
      .where(eq(agentChannels.id, channelId))
      .then((rows) => rows[0] ?? null);

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;

    const messages = await getMessages(db, channelId, {
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50,
      before,
    });

    res.json(messages);
  });

  // POST /api/companies/:companyId/channels/:channelId/messages
  router.post("/companies/:companyId/channels/:channelId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    const channelId = req.params.channelId as string;
    assertCompanyAccess(req, companyId);

    // Verify the channel belongs to this company
    const channel = await db
      .select({ id: agentChannels.id, companyId: agentChannels.companyId })
      .from(agentChannels)
      .where(eq(agentChannels.id, channelId))
      .then((rows) => rows[0] ?? null);

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    if (channel.companyId !== companyId) {
      res.status(403).json({ error: "Channel does not belong to this company" });
      return;
    }

    const body = req.body as {
      body?: unknown;
      messageType?: unknown;
      mentions?: unknown;
      linkedIssueId?: unknown;
      replyToId?: unknown;
    };

    if (typeof body.body !== "string" || body.body.trim().length === 0) {
      res.status(400).json({ error: "body is required" });
      return;
    }

    const actor = getActorInfo(req);

    const message = await postMessage(db, {
      channelId,
      companyId,
      authorAgentId: actor.agentId ?? undefined,
      authorUserId: actor.actorType === "user" ? actor.actorId : undefined,
      body: body.body.trim(),
      messageType: typeof body.messageType === "string" ? body.messageType : "message",
      mentions: Array.isArray(body.mentions) ? (body.mentions as string[]) : [],
      linkedIssueId: typeof body.linkedIssueId === "string" ? body.linkedIssueId : undefined,
      replyToId: typeof body.replyToId === "string" ? body.replyToId : undefined,
    });

    // Broadcast SSE event to all connected clients for this company
    publishLiveEvent({
      companyId,
      type: "channel.message",
      payload: { message, channelId },
    });

    res.status(201).json(message);
  });

  return router;
}
