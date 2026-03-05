import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  chatSearchQuerySchema,
  createChatChannelSchema,
  createChatMessageSchema,
  listChatConversationsQuerySchema,
  listChatMessagesQuerySchema,
  openChatDmSchema,
  toggleChatReactionSchema,
  updateChatConversationSchema,
  updateChatReadStateSchema,
} from "@paperclipai/shared";
import { forbidden, notFound, unauthorized } from "../errors.js";
import { validate } from "../middleware/validate.js";
import {
  chatDeliveryService,
  chatService,
  heartbeatService,
  logActivity,
  publishLiveEvent,
} from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

function decodeEmojiParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolvePrincipal(req: Request) {
  if (req.actor.type === "agent" && req.actor.agentId) {
    return {
      principalType: "agent" as const,
      principalId: req.actor.agentId,
      isBoard: false,
    };
  }
  if (req.actor.type === "board" && req.actor.userId) {
    return {
      principalType: "user" as const,
      principalId: req.actor.userId,
      isBoard: true,
    };
  }
  throw unauthorized();
}

function publishDeliveryUpdate(input: {
  companyId: string;
  conversationId: string;
  sourceMessageId: string;
  targetAgentId: string;
  status: string;
  attemptCount: number;
  timeoutAt: Date;
  lastError: string | null;
  resolvedByMessageId: string | null;
}) {
  publishLiveEvent({
    companyId: input.companyId,
    type: "chat.delivery.updated",
    payload: {
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      targetAgentId: input.targetAgentId,
      status: input.status,
      attemptCount: input.attemptCount,
      timeoutAt: input.timeoutAt.toISOString(),
      lastError: input.lastError,
      resolvedByMessageId: input.resolvedByMessageId,
    },
  });
}

export function chatRoutes(db: Db) {
  const router = Router();
  const chat = chatService(db);
  const deliveries = chatDeliveryService(db);
  const heartbeat = heartbeatService(db);

  router.get("/companies/:companyId/chat/conversations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const principal = resolvePrincipal(req);
    if (principal.isBoard && principal.principalType === "user") {
      await chat.ensureBoardAgentDms(companyId, principal.principalId);
    }
    const query = listChatConversationsQuerySchema.parse(req.query);
    const conversations = await chat.listConversations(companyId, principal, query);
    res.json(conversations);
  });

  router.post("/companies/:companyId/chat/channels", validate(createChatChannelSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const channel = await chat.createChannel(companyId, {
      ...req.body,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "chat.channel_created",
      entityType: "chat_conversation",
      entityId: channel.id,
      details: {
        kind: channel.kind,
        name: channel.name,
        slug: channel.slug,
      },
    });
    publishLiveEvent({
      companyId,
      type: "chat.conversation.created",
      payload: {
        conversationId: channel.id,
        kind: channel.kind,
        name: channel.name,
        slug: channel.slug,
      },
    });
    res.status(201).json(channel);
  });

  router.patch("/chat/conversations/:conversationId", validate(updateChatConversationSchema), async (req, res) => {
    const conversationId = req.params.conversationId as string;
    const existing = await chat.getConversationById(conversationId);
    if (!existing) {
      throw notFound("Conversation not found");
    }
    assertCompanyAccess(req, existing.companyId);

    if (existing.kind === "dm" && req.actor.type !== "board") {
      throw forbidden("Only board can update direct messages");
    }
    if (existing.kind === "channel" && req.actor.type === "none") {
      throw unauthorized();
    }

    const updated = await chat.updateConversation(conversationId, req.body);
    const actor = getActorInfo(req);
    const action = req.body.archived === true
      ? "chat.channel_archived"
      : req.body.archived === false
        ? "chat.channel_unarchived"
        : "chat.channel_updated";
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action,
      entityType: "chat_conversation",
      entityId: updated.id,
      details: {
        kind: updated.kind,
        name: updated.name,
        slug: updated.slug,
        archivedAt: updated.archivedAt,
      },
    });
    publishLiveEvent({
      companyId: updated.companyId,
      type: "chat.conversation.updated",
      payload: {
        conversationId: updated.id,
        kind: updated.kind,
        name: updated.name,
        slug: updated.slug,
        archivedAt: updated.archivedAt ? new Date(updated.archivedAt).toISOString() : null,
      },
    });
    res.json(updated);
  });

  router.post("/companies/:companyId/chat/dms", validate(openChatDmSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const principal = resolvePrincipal(req);
    const actor = getActorInfo(req);
    const opened = await chat.openDm({
      companyId,
      actor: principal,
      participantAgentId: req.body.participantAgentId ?? null,
      participantUserId: req.body.participantUserId ?? null,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });
    if (opened.created) {
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "chat.dm_opened",
        entityType: "chat_conversation",
        entityId: opened.conversation.id,
        details: {
          kind: "dm",
        },
      });
      publishLiveEvent({
        companyId,
        type: "chat.conversation.created",
        payload: {
          conversationId: opened.conversation.id,
          kind: "dm",
          name: opened.conversation.name,
        },
      });
    }
    res.status(opened.created ? 201 : 200).json(opened.conversation);
  });

  router.get("/chat/conversations/:conversationId/messages", async (req, res) => {
    const conversationId = req.params.conversationId as string;
    const conversation = await chat.getConversationById(conversationId);
    if (!conversation) {
      throw notFound("Conversation not found");
    }
    assertCompanyAccess(req, conversation.companyId);
    const principal = resolvePrincipal(req);
    const query = listChatMessagesQuerySchema.parse(req.query);
    const messages = await chat.listMessages({
      conversationId,
      threadRootMessageId: query.threadRootMessageId ?? null,
      before: query.before,
      after: query.after,
      limit: query.limit,
    }, principal);
    res.json(messages);
  });

  router.post("/chat/conversations/:conversationId/messages", validate(createChatMessageSchema), async (req, res) => {
    const conversationId = req.params.conversationId as string;
    const conversation = await chat.getConversationById(conversationId);
    if (!conversation) {
      throw notFound("Conversation not found");
    }
    assertCompanyAccess(req, conversation.companyId);
    const principal = resolvePrincipal(req);
    const actor = getActorInfo(req);
    const message = await chat.createMessage(
      {
        conversationId,
        companyId: conversation.companyId,
        authorAgentId: actor.agentId,
        authorUserId: actor.actorType === "user" ? actor.actorId : null,
        body: req.body.body,
        threadRootMessageId: req.body.threadRootMessageId ?? null,
      },
      principal,
    );

    await logActivity(db, {
      companyId: conversation.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "chat.message_posted",
      entityType: "chat_message",
      entityId: message.id,
      details: {
        conversationId: message.conversationId,
        threadRootMessageId: message.threadRootMessageId,
      },
    });

    publishLiveEvent({
      companyId: conversation.companyId,
      type: "chat.message.created",
      payload: {
        conversationId: message.conversationId,
        messageId: message.id,
        threadRootMessageId: message.threadRootMessageId,
        kind: conversation.kind,
        createdAt: new Date(message.createdAt).toISOString(),
      },
    });

    if (actor.agentId) {
      const replied = await deliveries.markRepliedByAgentMessage({
        conversationId: conversation.id,
        targetAgentId: actor.agentId,
        replyMessageId: message.id,
        replyCreatedAt: message.createdAt,
      });
      for (const expectation of replied) {
        publishDeliveryUpdate({
          companyId: expectation.companyId,
          conversationId: expectation.conversationId,
          sourceMessageId: expectation.sourceMessageId,
          targetAgentId: expectation.targetAgentId,
          status: expectation.status,
          attemptCount: expectation.attemptCount,
          timeoutAt: expectation.timeoutAt,
          lastError: expectation.lastError,
          resolvedByMessageId: expectation.resolvedByMessageId,
        });
      }
    }

    const routing = await chat.resolveWakeTargetsForMessage({
      conversationId: conversation.id,
      companyId: conversation.companyId,
      conversationKind: conversation.kind as "channel" | "dm",
      body: message.body,
      explicitMentionAgentIds: req.body.mentionAgentIds ?? [],
      senderAgentId: actor.agentId,
    });
    const wakeTargets = routing.wakeTargets;
    const expectationByAgentId = new Map<string, Awaited<ReturnType<typeof deliveries.createExpectations>>[number]>();

    const expectationTargetAgentIds =
      actor.actorType !== "user"
        ? []
        : conversation.kind === "dm"
          ? wakeTargets.map((target) => target.agentId)
          : wakeTargets
            .filter((target) => target.isExplicitMention)
            .map((target) => target.agentId);

    if (expectationTargetAgentIds.length > 0) {
      const createdExpectations = await deliveries.createExpectations({
        companyId: conversation.companyId,
        conversationId: conversation.id,
        sourceMessageId: message.id,
        targetAgentIds: expectationTargetAgentIds,
      });
      for (const expectation of createdExpectations) {
        expectationByAgentId.set(expectation.targetAgentId, expectation);
        publishDeliveryUpdate({
          companyId: expectation.companyId,
          conversationId: expectation.conversationId,
          sourceMessageId: expectation.sourceMessageId,
          targetAgentId: expectation.targetAgentId,
          status: expectation.status,
          attemptCount: expectation.attemptCount,
          timeoutAt: expectation.timeoutAt,
          lastError: expectation.lastError,
          resolvedByMessageId: expectation.resolvedByMessageId,
        });
      }
    }

    const threadRootId = message.threadRootMessageId ?? message.id;
    for (const wakeTarget of wakeTargets) {
      const wakeupAgentId = wakeTarget.agentId;
      const isExplicitMention = wakeTarget.isExplicitMention;
      const wakeReason = conversation.kind === "dm" ? "chat_mentioned" : wakeTarget.wakeReason;
      const expectation = expectationByAgentId.get(wakeupAgentId) ?? null;

      if (isExplicitMention) {
        publishLiveEvent({
          companyId: conversation.companyId,
          type: "chat.mentioned",
          payload: {
            conversationId: message.conversationId,
            messageId: message.id,
            threadRootMessageId: threadRootId,
            kind: conversation.kind,
            agentId: wakeupAgentId,
            byAgentId: actor.agentId,
            byUserId: actor.actorType === "user" ? actor.actorId : null,
          },
        });
      }

      try {
        const wake = await heartbeat.wakeup(wakeupAgentId, {
          source: "automation",
          triggerDetail: "system",
          reason: wakeReason,
          payload: {
            conversationId: message.conversationId,
            messageId: message.id,
            threadRootMessageId: threadRootId,
            kind: conversation.kind,
          },
          idempotencyKey: `chat:${message.id}:${wakeupAgentId}`,
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: {
            taskKey: `chat:${message.conversationId}`,
            chatConversationId: message.conversationId,
            chatMessageId: message.id,
            chatThreadRootId: threadRootId,
            chatKind: conversation.kind,
            wakeReason,
            source: isExplicitMention ? "chat.mention" : conversation.kind === "dm" ? "chat.dm" : "chat.message",
            wakeRoute: wakeTarget.route,
            chatRelevanceScore: wakeTarget.relevanceScore,
          },
        });

        if (!wake && expectation) {
          const failed = await deliveries.markFailed(
            expectation.id,
            "Wakeup request was skipped by policy",
          );
          if (failed) {
            publishDeliveryUpdate({
              companyId: failed.companyId,
              conversationId: failed.conversationId,
              sourceMessageId: failed.sourceMessageId,
              targetAgentId: failed.targetAgentId,
              status: failed.status,
              attemptCount: failed.attemptCount,
              timeoutAt: failed.timeoutAt,
              lastError: failed.lastError,
              resolvedByMessageId: failed.resolvedByMessageId,
            });
            await logActivity(db, {
              companyId: failed.companyId,
              actorType: actor.actorType,
              actorId: actor.actorId,
              agentId: actor.agentId,
              runId: actor.runId,
              action: "chat.delivery_failed",
              entityType: "chat_message",
              entityId: message.id,
              details: {
                conversationId: failed.conversationId,
                sourceMessageId: failed.sourceMessageId,
                targetAgentId: failed.targetAgentId,
                reason: failed.lastError,
              },
            });
          }
        }
      } catch (error) {
        if (!expectation) continue;
        const failed = await deliveries.markFailed(
          expectation.id,
          error instanceof Error ? error.message : String(error),
        );
        if (!failed) continue;
        publishDeliveryUpdate({
          companyId: failed.companyId,
          conversationId: failed.conversationId,
          sourceMessageId: failed.sourceMessageId,
          targetAgentId: failed.targetAgentId,
          status: failed.status,
          attemptCount: failed.attemptCount,
          timeoutAt: failed.timeoutAt,
          lastError: failed.lastError,
          resolvedByMessageId: failed.resolvedByMessageId,
        });
        await logActivity(db, {
          companyId: failed.companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          runId: actor.runId,
          action: "chat.delivery_failed",
          entityType: "chat_message",
          entityId: message.id,
          details: {
            conversationId: failed.conversationId,
            sourceMessageId: failed.sourceMessageId,
            targetAgentId: failed.targetAgentId,
            reason: failed.lastError,
          },
        });
      }
    }

    res.status(201).json(message);
  });

  router.delete("/chat/messages/:messageId", async (req, res) => {
    if (req.actor.type !== "board") {
      throw forbidden("Only board can delete messages");
    }
    const messageId = req.params.messageId as string;
    const existing = await chat.getMessageById(messageId);
    if (!existing) {
      throw notFound("Message not found");
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);
    const deleted = await chat.hardDeleteMessage(messageId);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "chat.message_deleted",
      entityType: "chat_message",
      entityId: messageId,
      details: {
        conversationId: existing.conversationId,
        removedMessageIds: deleted.deletedMessageIds,
      },
    });
    const deletedAt = new Date().toISOString();
    publishLiveEvent({
      companyId: existing.companyId,
      type: "chat.message.deleted",
      payload: {
        conversationId: existing.conversationId,
        messageId: existing.id,
        threadRootMessageId: existing.threadRootMessageId ?? existing.id,
        deletedMessageIds: deleted.deletedMessageIds,
        deletedAt,
      },
    });
    res.json(deleted.deletedMessage);
  });

  router.post("/chat/messages/:messageId/reactions", validate(toggleChatReactionSchema), async (req, res) => {
    const messageId = req.params.messageId as string;
    const existing = await chat.getMessageById(messageId);
    if (!existing) {
      throw notFound("Message not found");
    }
    assertCompanyAccess(req, existing.companyId);
    const principal = resolvePrincipal(req);
    const actor = getActorInfo(req);
    const reaction = await chat.addReaction(messageId, principal, req.body.emoji);
    if (reaction.inserted) {
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "chat.reaction_added",
        entityType: "chat_message",
        entityId: messageId,
        details: {
          conversationId: existing.conversationId,
          emoji: req.body.emoji,
        },
      });
    }
    publishLiveEvent({
      companyId: existing.companyId,
      type: "chat.reaction.updated",
      payload: {
        conversationId: existing.conversationId,
        messageId,
        reactions: reaction.reactions,
      },
    });
    res.status(reaction.inserted ? 201 : 200).json(reaction.reactions);
  });

  router.delete("/chat/messages/:messageId/reactions/:emoji", async (req, res) => {
    const messageId = req.params.messageId as string;
    const emoji = decodeEmojiParam(req.params.emoji as string);
    const existing = await chat.getMessageById(messageId);
    if (!existing) {
      throw notFound("Message not found");
    }
    assertCompanyAccess(req, existing.companyId);
    const principal = resolvePrincipal(req);
    const actor = getActorInfo(req);
    const reaction = await chat.removeReaction(messageId, principal, emoji);
    if (reaction.removed) {
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "chat.reaction_removed",
        entityType: "chat_message",
        entityId: messageId,
        details: {
          conversationId: existing.conversationId,
          emoji,
        },
      });
    }
    publishLiveEvent({
      companyId: existing.companyId,
      type: "chat.reaction.updated",
      payload: {
        conversationId: existing.conversationId,
        messageId,
        reactions: reaction.reactions,
      },
    });
    res.json({ ok: true, reactions: reaction.reactions });
  });

  router.post("/chat/conversations/:conversationId/read", validate(updateChatReadStateSchema), async (req, res) => {
    const conversationId = req.params.conversationId as string;
    const conversation = await chat.getConversationById(conversationId);
    if (!conversation) {
      throw notFound("Conversation not found");
    }
    assertCompanyAccess(req, conversation.companyId);
    const principal = resolvePrincipal(req);
    const readState = await chat.markRead(
      conversationId,
      conversation.companyId,
      principal,
      req.body.lastReadMessageId ?? null,
    );
    publishLiveEvent({
      companyId: conversation.companyId,
      type: "chat.read.updated",
      payload: {
        conversationId,
        principalType: principal.principalType,
        principalId: principal.principalId,
        lastReadMessageId: readState.lastReadMessageId,
        lastReadAt: readState.lastReadAt ? new Date(readState.lastReadAt).toISOString() : null,
      },
    });
    res.json(readState);
  });

  router.get("/companies/:companyId/chat/search", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const principal = resolvePrincipal(req);
    const query = chatSearchQuerySchema.parse(req.query);
    const results = await chat.searchMessages({
      companyId,
      principal,
      q: query.q,
      limit: query.limit,
      conversationId: query.conversationId ?? null,
    });
    res.json(results);
  });

  return router;
}
