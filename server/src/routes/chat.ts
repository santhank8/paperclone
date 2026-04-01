import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, lt } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatRooms, chatMessages, agents } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { heartbeatService, logActivity } from "../services/index.js";
import { issueService } from "../services/index.js";
import { publishLiveEvent } from "../services/live-events.js";
import { logger } from "../middleware/logger.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

const createRoomSchema = z.object({
  kind: z.enum(["direct", "boardroom"]),
  agentId: z.string().uuid().optional(),
});

const postMessageSchema = z.object({
  body: z.string().min(1).max(100_000),
});

const MAX_MESSAGE_LIMIT = 200;

export function chatRoutes(db: Db) {
  const router = Router();
  const heartbeat = heartbeatService(db);
  const issueSvc = issueService(db);

  // List rooms for a company
  router.get("/companies/:companyId/chat/rooms", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const rooms = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.companyId, companyId))
      .orderBy(desc(chatRooms.updatedAt));

    res.json(rooms);
  });

  // Get single room
  router.get("/companies/:companyId/chat/rooms/:roomId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const roomId = req.params.roomId as string;
    assertCompanyAccess(req, companyId);

    const [room] = await db
      .select()
      .from(chatRooms)
      .where(and(eq(chatRooms.id, roomId), eq(chatRooms.companyId, companyId)));

    if (!room) {
      res.status(404).json({ error: "Chat room not found" });
      return;
    }
    res.json(room);
  });

  // Find-or-create room
  router.post(
    "/companies/:companyId/chat/rooms",
    validate(createRoomSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { kind, agentId } = req.body as z.infer<typeof createRoomSchema>;

      if (kind === "direct") {
        if (!agentId) {
          res.status(400).json({ error: "agentId is required for direct rooms" });
          return;
        }
        // Check agent exists and belongs to company
        const [agent] = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));
        if (!agent) {
          res.status(404).json({ error: "Agent not found" });
          return;
        }

        // Find or create
        const [existing] = await db
          .select()
          .from(chatRooms)
          .where(
            and(
              eq(chatRooms.companyId, companyId),
              eq(chatRooms.agentId, agentId),
              eq(chatRooms.kind, "direct"),
            ),
          );
        if (existing) {
          res.json(existing);
          return;
        }

        const [room] = await db
          .insert(chatRooms)
          .values({ companyId, kind: "direct", agentId })
          .returning();
        res.status(201).json(room);
        return;
      }

      // Boardroom: find or create the single boardroom
      const [existing] = await db
        .select()
        .from(chatRooms)
        .where(and(eq(chatRooms.companyId, companyId), eq(chatRooms.kind, "boardroom")));
      if (existing) {
        res.json(existing);
        return;
      }

      const [room] = await db
        .insert(chatRooms)
        .values({ companyId, kind: "boardroom", title: "Boardroom" })
        .returning();
      res.status(201).json(room);
    },
  );

  // List messages for a room (cursor-based, newest first)
  router.get("/companies/:companyId/chat/rooms/:roomId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    const roomId = req.params.roomId as string;
    assertCompanyAccess(req, companyId);

    // Verify room exists and belongs to company
    const [room] = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .where(and(eq(chatRooms.id, roomId), eq(chatRooms.companyId, companyId)));
    if (!room) {
      res.status(404).json({ error: "Chat room not found" });
      return;
    }

    const limitRaw =
      typeof req.query.limit === "string" ? Number(req.query.limit) : MAX_MESSAGE_LIMIT;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_MESSAGE_LIMIT)
        : MAX_MESSAGE_LIMIT;

    const before =
      typeof req.query.before === "string" && req.query.before.trim().length > 0
        ? req.query.before.trim()
        : null;

    if (!before) {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatRoomId, roomId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
      res.json(messages);
      return;
    }

    // Fetch the cursor message's createdAt for keyset pagination
    const [cursor] = await db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.id, before));

    if (!cursor) {
      res.json([]);
      return;
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.chatRoomId, roomId),
          lt(chatMessages.createdAt, cursor.createdAt),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    res.json(messages);
  });

  // Post a message
  router.post(
    "/companies/:companyId/chat/rooms/:roomId/messages",
    validate(postMessageSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const roomId = req.params.roomId as string;
      assertCompanyAccess(req, companyId);

      const [room] = await db
        .select()
        .from(chatRooms)
        .where(and(eq(chatRooms.id, roomId), eq(chatRooms.companyId, companyId)));
      if (!room) {
        res.status(404).json({ error: "Chat room not found" });
        return;
      }

      const actor = getActorInfo(req);
      const body: string = req.body.body;

      const [message] = await db
        .insert(chatMessages)
        .values({
          companyId,
          chatRoomId: roomId,
          authorAgentId: actor.agentId ?? undefined,
          authorUserId: actor.actorType === "user" ? actor.actorId : undefined,
          body,
          runId: actor.runId ?? undefined,
        })
        .returning();

      // Update room timestamp
      await db
        .update(chatRooms)
        .set({ updatedAt: new Date() })
        .where(eq(chatRooms.id, roomId));

      // Publish live event
      publishLiveEvent({
        companyId,
        type: "chat.message.created",
        payload: {
          chatRoomId: roomId,
          messageId: message.id,
          authorAgentId: actor.agentId ?? null,
          authorUserId: actor.actorType === "user" ? actor.actorId : null,
          roomKind: room.kind,
        },
      });

      // Log activity
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "chat.message_added",
        entityType: "chat_room",
        entityId: roomId,
        details: {
          messageId: message.id,
          bodySnippet: body.slice(0, 120),
          roomKind: room.kind,
          roomAgentId: room.agentId,
        },
      });

      // Trigger agent wakeups (fire-and-forget)
      void (async () => {
        const actorIsAgent = actor.actorType === "agent";

        if (room.kind === "direct" && room.agentId) {
          // Direct chat: wake the room's agent (unless it's the author)
          if (actorIsAgent && actor.actorId === room.agentId) return;
          heartbeat
            .wakeup(room.agentId, {
              source: "automation",
              triggerDetail: "system",
              reason: "chat_message",
              payload: { chatRoomId: roomId, messageId: message.id },
              requestedByActorType: actor.actorType,
              requestedByActorId: actor.actorId,
              contextSnapshot: {
                chatRoomId: roomId,
                messageId: message.id,
                wakeReason: "chat_message",
                source: "chat.direct",
              },
            })
            .catch((err) =>
              logger.warn({ err, roomId, agentId: room.agentId }, "failed to wake agent on chat message"),
            );
        } else if (room.kind === "boardroom") {
          // Boardroom: wake only @mentioned agents
          let mentionedIds: string[] = [];
          try {
            mentionedIds = await issueSvc.findMentionedAgents(companyId, body);
          } catch (err) {
            logger.warn({ err, roomId }, "failed to resolve @-mentions in boardroom message");
          }

          for (const agentId of mentionedIds) {
            if (actorIsAgent && actor.actorId === agentId) continue;
            heartbeat
              .wakeup(agentId, {
                source: "automation",
                triggerDetail: "system",
                reason: "chat_message_mentioned",
                payload: { chatRoomId: roomId, messageId: message.id },
                requestedByActorType: actor.actorType,
                requestedByActorId: actor.actorId,
                contextSnapshot: {
                  chatRoomId: roomId,
                  messageId: message.id,
                  wakeReason: "chat_message_mentioned",
                  source: "chat.boardroom",
                },
              })
              .catch((err) =>
                logger.warn({ err, roomId, agentId }, "failed to wake agent on boardroom mention"),
              );
          }
        }
      })();

      res.status(201).json(message);
    },
  );

  return router;
}
