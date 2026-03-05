import { and, asc, desc, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { chatConversations, chatDeliveryExpectations, chatMessages } from "@paperclipai/db";
import type { ChatDeliveryExpectation, ChatDeliveryStatus } from "@paperclipai/shared";

const DELIVERY_TIMEOUT_SEC = 60;
const DELIVERY_CHECK_INTERVAL_SEC = 5;
const MAX_DELIVERY_RETRIES = 1;

type WakeupFn = (
  agentId: string,
  opts: {
    source: "automation";
    triggerDetail: "system";
    reason: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    requestedByActorType?: "user" | "agent" | "system";
    requestedByActorId?: string;
    contextSnapshot?: Record<string, unknown>;
  },
) => Promise<{ id: string } | null>;

function addSeconds(value: Date, seconds: number) {
  return new Date(value.getTime() + seconds * 1000);
}

function toExpectation(
  row: typeof chatDeliveryExpectations.$inferSelect,
): ChatDeliveryExpectation {
  return {
    ...row,
    status: row.status as ChatDeliveryStatus,
  };
}

function isRetryableStatus(status: ChatDeliveryStatus) {
  return status === "pending" || status === "retrying";
}

export interface ChatDeliveryTransition {
  expectation: ChatDeliveryExpectation;
  previousStatus: ChatDeliveryStatus;
}

export function chatDeliveryService(db: Db) {
  async function setStatus(
    expectationId: string,
    next: ChatDeliveryStatus,
    patch: Partial<typeof chatDeliveryExpectations.$inferInsert> = {},
  ) {
    const [updated] = await db
      .update(chatDeliveryExpectations)
      .set({
        status: next,
        updatedAt: new Date(),
        ...patch,
      })
      .where(eq(chatDeliveryExpectations.id, expectationId))
      .returning();
    return updated ? toExpectation(updated) : null;
  }

  async function getSourceMessage(messageId: string) {
    return db
      .select({
        id: chatMessages.id,
        companyId: chatMessages.companyId,
        conversationId: chatMessages.conversationId,
        threadRootMessageId: chatMessages.threadRootMessageId,
        kind: chatConversations.kind,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatConversations, eq(chatConversations.id, chatMessages.conversationId))
      .where(eq(chatMessages.id, messageId))
      .then((rows) => rows[0] ?? null);
  }

  async function findReplyAfter(
    conversationId: string,
    targetAgentId: string,
    sourceCreatedAt: Date,
  ) {
    return db
      .select({
        id: chatMessages.id,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          eq(chatMessages.authorAgentId, targetAgentId),
          gt(chatMessages.createdAt, sourceCreatedAt),
          isNull(chatMessages.deletedAt),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  return {
    createExpectations: async (input: {
      companyId: string;
      conversationId: string;
      sourceMessageId: string;
      targetAgentIds: string[];
      timeoutSec?: number;
      checkIntervalSec?: number;
    }) => {
      const targetAgentIds = [...new Set(input.targetAgentIds)];
      if (targetAgentIds.length === 0) return [] as ChatDeliveryExpectation[];

      const now = new Date();
      const timeoutAt = addSeconds(now, input.timeoutSec ?? DELIVERY_TIMEOUT_SEC);
      const nextCheckAt = addSeconds(now, input.checkIntervalSec ?? DELIVERY_CHECK_INTERVAL_SEC);

      const inserted = await db
        .insert(chatDeliveryExpectations)
        .values(
          targetAgentIds.map((targetAgentId) => ({
            companyId: input.companyId,
            conversationId: input.conversationId,
            sourceMessageId: input.sourceMessageId,
            targetAgentId,
            status: "pending",
            attemptCount: 0,
            timeoutAt,
            nextCheckAt,
          })),
        )
        .onConflictDoNothing({
          target: [
            chatDeliveryExpectations.sourceMessageId,
            chatDeliveryExpectations.targetAgentId,
          ],
        })
        .returning();

      return inserted.map(toExpectation);
    },

    listExpectationsBySourceMessageIds: async (sourceMessageIds: string[]) => {
      if (sourceMessageIds.length === 0) return new Map<string, ChatDeliveryExpectation>();

      const rows = await db
        .select()
        .from(chatDeliveryExpectations)
        .where(inArray(chatDeliveryExpectations.sourceMessageId, sourceMessageIds))
        .orderBy(desc(chatDeliveryExpectations.updatedAt));

      const mapped = new Map<string, ChatDeliveryExpectation>();
      for (const row of rows) {
        if (!mapped.has(row.sourceMessageId)) {
          mapped.set(row.sourceMessageId, toExpectation(row));
        }
      }
      return mapped;
    },

    markFailed: async (expectationId: string, error: string) => {
      return setStatus(expectationId, "failed", {
        lastError: error.slice(0, 600),
        nextCheckAt: new Date(),
      });
    },

    markRepliedByAgentMessage: async (input: {
      conversationId: string;
      targetAgentId: string;
      replyMessageId: string;
      replyCreatedAt: Date;
    }) => {
      const candidates = await db
        .select({
          id: chatDeliveryExpectations.id,
          sourceCreatedAt: chatMessages.createdAt,
        })
        .from(chatDeliveryExpectations)
        .innerJoin(chatMessages, eq(chatMessages.id, chatDeliveryExpectations.sourceMessageId))
        .where(
          and(
            eq(chatDeliveryExpectations.conversationId, input.conversationId),
            eq(chatDeliveryExpectations.targetAgentId, input.targetAgentId),
            inArray(chatDeliveryExpectations.status, ["pending", "retrying"]),
            lt(chatMessages.createdAt, input.replyCreatedAt),
          ),
        )
        .orderBy(asc(chatMessages.createdAt));

      const updated: ChatDeliveryExpectation[] = [];
      for (const candidate of candidates) {
        const expectation = await setStatus(candidate.id, "replied", {
          resolvedByMessageId: input.replyMessageId,
          lastError: null,
          nextCheckAt: new Date(),
        });
        if (expectation) updated.push(expectation);
      }
      return updated;
    },

    processDueExpectations: async (opts: {
      now?: Date;
      limit?: number;
      wakeup: WakeupFn;
    }) => {
      const now = opts.now ?? new Date();
      const limit = opts.limit ?? 50;

      const due = await db
        .select()
        .from(chatDeliveryExpectations)
        .where(
          and(
            inArray(chatDeliveryExpectations.status, ["pending", "retrying"]),
            lte(chatDeliveryExpectations.nextCheckAt, now),
          ),
        )
        .orderBy(asc(chatDeliveryExpectations.nextCheckAt))
        .limit(limit);

      const transitions: ChatDeliveryTransition[] = [];
      for (const row of due) {
        const expectation = toExpectation(row);
        if (!isRetryableStatus(expectation.status)) continue;

        const sourceMessage = await getSourceMessage(expectation.sourceMessageId);
        if (!sourceMessage) {
          const failed = await setStatus(expectation.id, "failed", {
            lastError: "Source message no longer exists",
            nextCheckAt: now,
          });
          if (failed) {
            transitions.push({ expectation: failed, previousStatus: expectation.status });
          }
          continue;
        }

        const reply = await findReplyAfter(
          expectation.conversationId,
          expectation.targetAgentId,
          sourceMessage.createdAt,
        );
        if (reply) {
          const replied = await setStatus(expectation.id, "replied", {
            resolvedByMessageId: reply.id,
            lastError: null,
            nextCheckAt: now,
          });
          if (replied) {
            transitions.push({ expectation: replied, previousStatus: expectation.status });
          }
          continue;
        }

        if (now < expectation.timeoutAt) {
          await db
            .update(chatDeliveryExpectations)
            .set({
              nextCheckAt: addSeconds(now, DELIVERY_CHECK_INTERVAL_SEC),
              updatedAt: now,
            })
            .where(eq(chatDeliveryExpectations.id, expectation.id));
          continue;
        }

        if (expectation.attemptCount < MAX_DELIVERY_RETRIES) {
          const retrying = await setStatus(expectation.id, "retrying", {
            attemptCount: expectation.attemptCount + 1,
            timeoutAt: addSeconds(now, DELIVERY_TIMEOUT_SEC),
            nextCheckAt: addSeconds(now, DELIVERY_CHECK_INTERVAL_SEC),
            lastError: null,
          });
          if (retrying) {
            transitions.push({ expectation: retrying, previousStatus: expectation.status });
            try {
              const threadRootId = sourceMessage.threadRootMessageId ?? sourceMessage.id;
              const run = await opts.wakeup(expectation.targetAgentId, {
                source: "automation",
                triggerDetail: "system",
                reason: "chat_mentioned",
                idempotencyKey: `chat-delivery-retry:${expectation.id}:${retrying.attemptCount}`,
                payload: {
                  conversationId: sourceMessage.conversationId,
                  messageId: sourceMessage.id,
                  threadRootMessageId: threadRootId,
                  kind: sourceMessage.kind,
                },
                requestedByActorType: "system",
                requestedByActorId: "chat_delivery_monitor",
                contextSnapshot: {
                  taskKey: `chat:${sourceMessage.conversationId}`,
                  chatConversationId: sourceMessage.conversationId,
                  chatMessageId: sourceMessage.id,
                  chatThreadRootId: threadRootId,
                  chatKind: sourceMessage.kind,
                  wakeReason: "chat_mentioned",
                  source: "chat.delivery.retry",
                },
              });
              if (!run) {
                const failed = await setStatus(expectation.id, "failed", {
                  nextCheckAt: now,
                  lastError: "Retry wakeup was skipped by policy",
                });
                if (failed) {
                  transitions.push({ expectation: failed, previousStatus: "retrying" });
                }
              }
            } catch (error) {
              const failed = await setStatus(expectation.id, "failed", {
                nextCheckAt: now,
                lastError: error instanceof Error ? error.message : String(error),
              });
              if (failed) {
                transitions.push({ expectation: failed, previousStatus: "retrying" });
              }
            }
          }
          continue;
        }

        const timedOut = await setStatus(expectation.id, "timed_out", {
          nextCheckAt: now,
          lastError: expectation.lastError,
        });
        if (timedOut) {
          transitions.push({ expectation: timedOut, previousStatus: expectation.status });
        }
      }

      return transitions;
    },
  };
}
