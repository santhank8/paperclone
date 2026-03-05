import { and, asc, desc, eq, inArray, isNull, lt, gt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  chatConversationParticipants,
  chatConversations,
  chatDeliveryExpectations,
  chatMessageReactions,
  chatMessages,
  chatReadStates,
  companyMemberships,
} from "@paperclipai/db";
import type {
  ChatConversation,
  ChatConversationParticipant,
  ChatDeliveryExpectation,
  ChatMessage,
  ChatMessageDelivery,
  ChatReactionAggregate,
  ChatReadState,
  ChatSearchResult,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface ChatPrincipal {
  principalType: "agent" | "user";
  principalId: string;
  isBoard: boolean;
}

export interface CreateChatChannelInput {
  name: string;
  slug?: string | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
}

export interface UpdateChatConversationInput {
  name?: string;
  archived?: boolean;
}

export interface OpenChatDmInput {
  companyId: string;
  actor: ChatPrincipal;
  participantAgentId?: string | null;
  participantUserId?: string | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
}

export interface CreateChatMessageInput {
  conversationId: string;
  companyId: string;
  authorAgentId?: string | null;
  authorUserId?: string | null;
  body: string;
  threadRootMessageId?: string | null;
}

export interface ListChatMessagesInput {
  conversationId: string;
  threadRootMessageId?: string | null;
  before?: string;
  after?: string;
  limit: number;
}

export interface SearchChatInput {
  companyId: string;
  principal: ChatPrincipal;
  q: string;
  limit: number;
  conversationId?: string | null;
}

function slugifyChannelName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 63) || "channel";
}

function normalizeDmParticipantKey(values: Array<{ principalType: "agent" | "user"; principalId: string }>): string {
  return values
    .map((value) => `${value.principalType}:${value.principalId}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: string }).code === "23505";
}

function parseMentionTokens(body: string): string[] {
  const re = /\B@([^\s@,!?.]+)/g;
  const tokens = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const token = match[1]?.trim().toLowerCase();
    if (token) tokens.add(token);
  }
  return [...tokens];
}

function normalizeMentionAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const CHAT_RELEVANCE_THRESHOLD = 0.45;
const CHAT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "who",
  "why",
  "you",
  "your",
]);

const ROLE_KEYWORDS: Record<string, string[]> = {
  ceo: ["strategy", "roadmap", "org", "headcount", "plan", "vision"],
  cto: ["architecture", "platform", "backend", "frontend", "api", "technical"],
  cmo: ["marketing", "campaign", "brand", "growth", "acquisition"],
  cfo: ["budget", "finance", "cost", "forecast", "spend"],
  engineer: ["bug", "fix", "code", "build", "implement", "deploy", "api", "refactor"],
  designer: ["design", "ux", "ui", "wireframe", "prototype", "layout"],
  pm: ["pm", "product", "spec", "requirements", "scope", "milestone", "priority", "backlog"],
  qa: ["qa", "test", "regression", "verify", "coverage", "repro"],
  devops: ["infra", "devops", "ci", "cd", "deploy", "ops", "incident"],
  researcher: ["research", "analysis", "investigate", "benchmark", "evaluate"],
};

function tokenizeForRelevance(value: string): string[] {
  const matches = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return matches.filter((token) => token.length >= 2 && !CHAT_STOP_WORDS.has(token));
}

function buildAgentProfileTokens(agent: {
  name: string;
  role: string;
  title: string | null;
  capabilities: string | null;
}) {
  return new Set(
    tokenizeForRelevance(
      [agent.name, agent.role, agent.title ?? "", agent.capabilities ?? ""].join(" "),
    ),
  );
}

function scoreAgentRelevance(
  agent: { role: string; name: string; title: string | null; capabilities: string | null },
  messageTokens: string[],
  messageTokenSet: Set<string>,
): number {
  if (messageTokens.length === 0) return 0;
  const profileTokens = buildAgentProfileTokens(agent);
  let overlapHits = 0;
  for (const token of messageTokens) {
    if (profileTokens.has(token)) overlapHits += 1;
  }
  const overlapScore = Math.min(0.6, (overlapHits / Math.max(1, Math.min(messageTokens.length, 6))) * 0.6);

  const roleKeywords = ROLE_KEYWORDS[agent.role] ?? [];
  let roleHits = 0;
  for (const keyword of roleKeywords) {
    if (messageTokenSet.has(keyword)) roleHits += 1;
  }
  const roleScore = roleHits === 0 ? 0 : Math.min(0.4, 0.22 + (roleHits - 1) * 0.08);

  return Math.min(1, overlapScore + roleScore);
}

function toDateOrNull(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function chatService(db: Db) {
  async function getConversationById(id: string) {
    return db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getMessageById(id: string) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getParticipantsByConversationIds(conversationIds: string[]) {
    if (conversationIds.length === 0) return new Map<string, ChatConversationParticipant[]>();
    const rows = await db
      .select()
      .from(chatConversationParticipants)
      .where(inArray(chatConversationParticipants.conversationId, conversationIds))
      .orderBy(asc(chatConversationParticipants.createdAt));

    const grouped = new Map<string, ChatConversationParticipant[]>();
    for (const row of rows) {
      const existing = grouped.get(row.conversationId) ?? [];
      existing.push({
        ...row,
        principalType: row.principalType as ChatConversationParticipant["principalType"],
      });
      grouped.set(row.conversationId, existing);
    }
    return grouped;
  }

  async function getParticipantsByConversationId(conversationId: string): Promise<ChatConversationParticipant[]> {
    const rows = await db
      .select()
      .from(chatConversationParticipants)
      .where(eq(chatConversationParticipants.conversationId, conversationId))
      .orderBy(asc(chatConversationParticipants.createdAt));
    return rows.map((row) => ({
      ...row,
      principalType: row.principalType as ChatConversationParticipant["principalType"],
    }));
  }

  async function getReadStatesByConversationIds(conversationIds: string[], principal: ChatPrincipal) {
    if (conversationIds.length === 0) return new Map<string, ChatReadState>();
    const rows = await db
      .select()
      .from(chatReadStates)
      .where(
        and(
          inArray(chatReadStates.conversationId, conversationIds),
          eq(chatReadStates.principalType, principal.principalType),
          eq(chatReadStates.principalId, principal.principalId),
        ),
      );
    const mapped = new Map<string, ChatReadState>();
    for (const row of rows) {
      mapped.set(row.conversationId, {
        ...row,
        principalType: row.principalType as ChatReadState["principalType"],
      });
    }
    return mapped;
  }

  async function getLatestMessagesByConversationIds(conversationIds: string[]) {
    if (conversationIds.length === 0) return new Map<string, ChatMessage>();
    const rows = await db
      .selectDistinctOn([chatMessages.conversationId], {
        id: chatMessages.id,
        companyId: chatMessages.companyId,
        conversationId: chatMessages.conversationId,
        threadRootMessageId: chatMessages.threadRootMessageId,
        authorAgentId: chatMessages.authorAgentId,
        authorUserId: chatMessages.authorUserId,
        body: chatMessages.body,
        deletedAt: chatMessages.deletedAt,
        deletedByUserId: chatMessages.deletedByUserId,
        deletedByAgentId: chatMessages.deletedByAgentId,
        createdAt: chatMessages.createdAt,
        updatedAt: chatMessages.updatedAt,
      })
      .from(chatMessages)
      .where(and(inArray(chatMessages.conversationId, conversationIds), isNull(chatMessages.deletedAt)))
      .orderBy(chatMessages.conversationId, desc(chatMessages.createdAt));
    const mapped = new Map<string, ChatMessage>();
    for (const row of rows) mapped.set(row.conversationId, row);
    return mapped;
  }

  async function getUnreadCountForConversation(
    conversationId: string,
    principal: ChatPrincipal,
    readState: ChatReadState | null,
  ) {
    const conditions = [
      eq(chatMessages.conversationId, conversationId),
      isNull(chatMessages.deletedAt),
    ];
    if (readState?.lastReadAt) {
      conditions.push(gt(chatMessages.createdAt, readState.lastReadAt));
    }
    if (principal.principalType === "agent") {
      conditions.push(
        or(
          isNull(chatMessages.authorAgentId),
          sql`${chatMessages.authorAgentId} <> ${principal.principalId}`,
        )!,
      );
    } else {
      conditions.push(
        or(
          isNull(chatMessages.authorUserId),
          sql`${chatMessages.authorUserId} <> ${principal.principalId}`,
        )!,
      );
    }

    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  }

  async function ensurePrincipalConversationAccess(
    conversation: typeof chatConversations.$inferSelect,
    principal: ChatPrincipal,
  ) {
    if (principal.isBoard) return true;
    if (conversation.kind === "channel") return true;
    const row = await db
      .select({ id: chatConversationParticipants.id })
      .from(chatConversationParticipants)
      .where(
        and(
          eq(chatConversationParticipants.conversationId, conversation.id),
          eq(chatConversationParticipants.principalType, principal.principalType),
          eq(chatConversationParticipants.principalId, principal.principalId),
        ),
      )
      .then((rows) => rows[0] ?? null);
    return Boolean(row);
  }

  async function resolveThreadRootMessageId(
    conversationId: string,
    threadRootMessageId?: string | null,
  ): Promise<string | null> {
    if (!threadRootMessageId) return null;
    const threadMessage = await db
      .select({
        id: chatMessages.id,
        conversationId: chatMessages.conversationId,
        threadRootMessageId: chatMessages.threadRootMessageId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, threadRootMessageId))
      .then((rows) => rows[0] ?? null);
    if (!threadMessage || threadMessage.conversationId !== conversationId) {
      throw notFound("Thread root message not found");
    }
    return threadMessage.threadRootMessageId ?? threadMessage.id;
  }

  async function upsertReadState(input: {
    conversationId: string;
    companyId: string;
    principalType: "agent" | "user";
    principalId: string;
    lastReadMessageId?: string | null;
    lastReadAt?: Date | null;
  }) {
    const now = new Date();
    const [row] = await db
      .insert(chatReadStates)
      .values({
        conversationId: input.conversationId,
        companyId: input.companyId,
        principalType: input.principalType,
        principalId: input.principalId,
        lastReadMessageId: input.lastReadMessageId ?? null,
        lastReadAt: input.lastReadAt ?? now,
      })
      .onConflictDoUpdate({
        target: [
          chatReadStates.conversationId,
          chatReadStates.principalType,
          chatReadStates.principalId,
        ],
        set: {
          lastReadMessageId: input.lastReadMessageId ?? null,
          lastReadAt: input.lastReadAt ?? now,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async function listReactionsForMessages(messageIds: string[], principal: ChatPrincipal) {
    if (messageIds.length === 0) return new Map<string, ChatReactionAggregate[]>();
    const rows = await db
      .select({
        messageId: chatMessageReactions.messageId,
        emoji: chatMessageReactions.emoji,
        principalType: chatMessageReactions.principalType,
        principalId: chatMessageReactions.principalId,
      })
      .from(chatMessageReactions)
      .where(inArray(chatMessageReactions.messageId, messageIds));

    const grouped = new Map<string, Map<string, ChatReactionAggregate>>();
    for (const row of rows) {
      const byEmoji = grouped.get(row.messageId) ?? new Map<string, ChatReactionAggregate>();
      const existing = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, reacted: false };
      existing.count += 1;
      if (row.principalType === principal.principalType && row.principalId === principal.principalId) {
        existing.reacted = true;
      }
      byEmoji.set(row.emoji, existing);
      grouped.set(row.messageId, byEmoji);
    }

    const mapped = new Map<string, ChatReactionAggregate[]>();
    for (const [messageId, byEmoji] of grouped.entries()) {
      mapped.set(
        messageId,
        [...byEmoji.values()].sort((left, right) =>
          right.count === left.count
            ? left.emoji.localeCompare(right.emoji)
            : right.count - left.count
        ),
      );
    }
    return mapped;
  }

  async function listReplyCounts(rootMessageIds: string[]) {
    if (rootMessageIds.length === 0) return new Map<string, number>();
    const rows = await db
      .select({
        threadRootMessageId: chatMessages.threadRootMessageId,
        count: sql<number>`count(*)`,
      })
      .from(chatMessages)
      .where(
        and(
          inArray(chatMessages.threadRootMessageId, rootMessageIds),
          isNull(chatMessages.deletedAt),
        ),
      )
      .groupBy(chatMessages.threadRootMessageId);
    const mapped = new Map<string, number>();
    for (const row of rows) {
      if (row.threadRootMessageId) {
        mapped.set(row.threadRootMessageId, Number(row.count ?? 0));
      }
    }
    return mapped;
  }

  async function findMentionedAgentIds(
    companyId: string,
    body: string,
    explicitMentionAgentIds: string[] = [],
  ) {
    const explicit = [...new Set(explicitMentionAgentIds)];
    const tokens = parseMentionTokens(body);
    const bodyLower = body.toLowerCase();
    if (tokens.length === 0 && explicit.length === 0 && !bodyLower.includes("@")) return [];

    const rows = await db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(eq(agents.companyId, companyId));
    const mentionedByName = rows
      .filter((row) => {
        const normalizedName = normalizeMentionAlias(row.name);
        const compactName = normalizedName.replace(/\s+/g, "");
        const firstToken = normalizedName.split(" ")[0] ?? normalizedName;
        return tokens.includes(normalizedName)
          || tokens.includes(compactName)
          || tokens.includes(firstToken)
          || bodyLower.includes(`@${normalizedName}`);
      })
      .map((row) => row.id);

    if (explicit.length === 0) {
      return [...new Set(mentionedByName)];
    }

    const validExplicit = rows
      .filter((row) => explicit.includes(row.id))
      .map((row) => row.id);

    return [...new Set([...mentionedByName, ...validExplicit])];
  }

  async function listLatestDeliveryBySourceMessageIds(sourceMessageIds: string[]) {
    if (sourceMessageIds.length === 0) return new Map<string, ChatMessageDelivery>();
    const rows = await db
      .select()
      .from(chatDeliveryExpectations)
      .where(inArray(chatDeliveryExpectations.sourceMessageId, sourceMessageIds))
      .orderBy(desc(chatDeliveryExpectations.updatedAt));

    const mapped = new Map<string, ChatMessageDelivery>();
    for (const row of rows) {
      if (mapped.has(row.sourceMessageId)) continue;
      mapped.set(row.sourceMessageId, {
        status: row.status as ChatDeliveryExpectation["status"],
        targetAgentId: row.targetAgentId,
        attemptCount: row.attemptCount,
        timeoutAt: row.timeoutAt,
        lastError: row.lastError ?? null,
        resolvedByMessageId: row.resolvedByMessageId ?? null,
      });
    }
    return mapped;
  }

  return {
    getConversationById,
    getMessageById,

    ensureGeneralChannel: async (companyId: string) => {
      const existing = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.companyId, companyId),
            eq(chatConversations.kind, "channel"),
            eq(chatConversations.slug, "general"),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (existing) return existing;

      const inserted = await db
        .insert(chatConversations)
        .values({
          companyId,
          kind: "channel",
          name: "general",
          slug: "general",
        })
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!inserted) throw conflict("Failed to create default #general channel");
      return inserted;
    },

    ensureBoardAgentDms: async (companyId: string, boardUserId: string) => {
      const companyAgents = await db
        .select({ id: agents.id, status: agents.status })
        .from(agents)
        .where(eq(agents.companyId, companyId));
      const activeAgentIds = companyAgents
        .filter((agent) => agent.status !== "terminated")
        .map((agent) => agent.id);
      if (activeAgentIds.length === 0) return;

      const participantKeys = activeAgentIds.map((agentId) =>
        normalizeDmParticipantKey([
          { principalType: "user", principalId: boardUserId },
          { principalType: "agent", principalId: agentId },
        ])
      );

      const existingRows = await db
        .select({ dmParticipantKey: chatConversations.dmParticipantKey })
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.companyId, companyId),
            eq(chatConversations.kind, "dm"),
            inArray(chatConversations.dmParticipantKey, participantKeys),
          ),
        );
      const existingKeys = new Set(existingRows.map((row) => row.dmParticipantKey).filter(Boolean));

      for (const agentId of activeAgentIds) {
        const participantKey = normalizeDmParticipantKey([
          { principalType: "user", principalId: boardUserId },
          { principalType: "agent", principalId: agentId },
        ]);
        if (existingKeys.has(participantKey)) continue;

        try {
          await db.transaction(async (tx) => {
            const [conversation] = await tx
              .insert(chatConversations)
              .values({
                companyId,
                kind: "dm",
                name: "Direct message",
                dmParticipantKey: participantKey,
                createdByUserId: boardUserId,
              })
              .returning();

            await tx.insert(chatConversationParticipants).values([
              {
                companyId,
                conversationId: conversation.id,
                principalType: "user",
                principalId: boardUserId,
              },
              {
                companyId,
                conversationId: conversation.id,
                principalType: "agent",
                principalId: agentId,
              },
            ]);
          });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }
    },

    listConversations: async (
      companyId: string,
      principal: ChatPrincipal,
      opts?: { includeArchived?: boolean },
    ): Promise<ChatConversation[]> => {
      const includeArchived = opts?.includeArchived ?? false;
      const visibilityCondition = principal.isBoard
        ? sql`TRUE`
        : principal.principalType === "agent"
          ? sql`
              ${chatConversations.kind} = 'channel'
              OR EXISTS (
                SELECT 1
                FROM ${chatConversationParticipants}
                WHERE ${chatConversationParticipants.conversationId} = ${chatConversations.id}
                  AND ${chatConversationParticipants.principalType} = ${principal.principalType}
                  AND ${chatConversationParticipants.principalId} = ${principal.principalId}
              )
            `
          : sql`
              EXISTS (
                SELECT 1
                FROM ${chatConversationParticipants}
                WHERE ${chatConversationParticipants.conversationId} = ${chatConversations.id}
                  AND ${chatConversationParticipants.principalType} = ${principal.principalType}
                  AND ${chatConversationParticipants.principalId} = ${principal.principalId}
              )
            `;

      const conditions = [eq(chatConversations.companyId, companyId), visibilityCondition];
      if (!includeArchived) {
        conditions.push(isNull(chatConversations.archivedAt));
      }

      const conversations = await db
        .select()
        .from(chatConversations)
        .where(and(...conditions))
        .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.updatedAt));

      const conversationIds = conversations.map((conversation) => conversation.id);
      const [participantsByConversation, latestMessagesByConversation, readStatesByConversation] = await Promise.all([
        getParticipantsByConversationIds(conversationIds),
        getLatestMessagesByConversationIds(conversationIds),
        getReadStatesByConversationIds(conversationIds, principal),
      ]);

      const unreadCounts = new Map<string, number>();
      await Promise.all(
        conversations.map(async (conversation) => {
          const readState = readStatesByConversation.get(conversation.id) ?? null;
          const unreadCount = await getUnreadCountForConversation(conversation.id, principal, readState);
          unreadCounts.set(conversation.id, unreadCount);
        }),
      );

      return conversations.map((conversation) => ({
        ...conversation,
        kind: conversation.kind as ChatConversation["kind"],
        participants: participantsByConversation.get(conversation.id) ?? [],
        unreadCount: unreadCounts.get(conversation.id) ?? 0,
        lastMessage: latestMessagesByConversation.get(conversation.id) ?? null,
      }));
    },

    createChannel: async (companyId: string, input: CreateChatChannelInput) => {
      const name = input.name.trim();
      const slug = input.slug ? input.slug.trim().toLowerCase() : slugifyChannelName(name);
      try {
        const [conversation] = await db
          .insert(chatConversations)
          .values({
            companyId,
            kind: "channel",
            name,
            slug,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
          })
          .returning();
        return conversation;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict(`Channel #${slug} already exists`);
        }
        throw error;
      }
    },

    updateConversation: async (conversationId: string, input: UpdateChatConversationInput) => {
      const conversation = await getConversationById(conversationId);
      if (!conversation) throw notFound("Conversation not found");

      const patch: Partial<typeof chatConversations.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        const name = input.name.trim();
        patch.name = name;
        if (conversation.kind === "channel" && conversation.slug && conversation.slug !== "general") {
          patch.slug = slugifyChannelName(name);
        }
      }

      if (input.archived !== undefined) {
        if (conversation.kind !== "channel") {
          throw unprocessable("Only channels can be archived");
        }
        if (conversation.slug === "general" && input.archived) {
          throw unprocessable("#general cannot be archived");
        }
        patch.archivedAt = input.archived ? new Date() : null;
      }

      const [updated] = await db
        .update(chatConversations)
        .set(patch)
        .where(eq(chatConversations.id, conversationId))
        .returning();
      return updated ?? conversation;
    },

    openDm: async (input: OpenChatDmInput) => {
      const actor = {
        principalType: input.actor.principalType,
        principalId: input.actor.principalId,
      };
      const target = input.participantAgentId
        ? { principalType: "agent" as const, principalId: input.participantAgentId }
        : input.participantUserId
          ? { principalType: "user" as const, principalId: input.participantUserId }
          : null;

      if (!target) {
        throw unprocessable("DM participant is required");
      }
      if (actor.principalType === target.principalType && actor.principalId === target.principalId) {
        throw unprocessable("Cannot open a DM with yourself");
      }

      if (target.principalType === "agent") {
        const targetAgent = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(eq(agents.id, target.principalId), eq(agents.companyId, input.companyId)))
          .then((rows) => rows[0] ?? null);
        if (!targetAgent) throw notFound("Target agent not found");
      } else {
        const targetMembership = await db
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, input.companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, target.principalId),
              eq(companyMemberships.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!targetMembership) throw notFound("Target user not found");
      }

      const participantKey = normalizeDmParticipantKey([actor, target]);
      const existing = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.companyId, input.companyId),
            eq(chatConversations.kind, "dm"),
            eq(chatConversations.dmParticipantKey, participantKey),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (existing) {
        return {
          conversation: existing,
          created: false,
        };
      }

      const created = await db.transaction(async (tx) => {
        const [conversation] = await tx
          .insert(chatConversations)
          .values({
            companyId: input.companyId,
            kind: "dm",
            name: "Direct message",
            dmParticipantKey: participantKey,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
          })
          .returning();

        await tx.insert(chatConversationParticipants).values([
          {
            companyId: input.companyId,
            conversationId: conversation.id,
            principalType: actor.principalType,
            principalId: actor.principalId,
          },
          {
            companyId: input.companyId,
            conversationId: conversation.id,
            principalType: target.principalType,
            principalId: target.principalId,
          },
        ]);

        return conversation;
      });

      return {
        conversation: created,
        created: true,
      };
    },

    canAccessConversation: ensurePrincipalConversationAccess,

    listMessages: async (
      input: ListChatMessagesInput,
      principal: ChatPrincipal,
    ): Promise<ChatMessage[]> => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation) throw notFound("Conversation not found");
      const canAccess = await ensurePrincipalConversationAccess(conversation, principal);
      if (!canAccess) throw notFound("Conversation not found");

      const before = toDateOrNull(input.before);
      const after = toDateOrNull(input.after);
      const normalizedThreadRoot = await resolveThreadRootMessageId(
        input.conversationId,
        input.threadRootMessageId,
      );

      const conditions = [
        eq(chatMessages.conversationId, input.conversationId),
        isNull(chatMessages.deletedAt),
      ];
      if (normalizedThreadRoot) {
        conditions.push(
          or(
            eq(chatMessages.id, normalizedThreadRoot),
            eq(chatMessages.threadRootMessageId, normalizedThreadRoot),
          )!,
        );
      } else {
        conditions.push(isNull(chatMessages.threadRootMessageId));
      }
      if (before) conditions.push(lt(chatMessages.createdAt, before));
      if (after) conditions.push(gt(chatMessages.createdAt, after));

      const rows = normalizedThreadRoot
        ? await db
          .select()
          .from(chatMessages)
          .where(and(...conditions))
          .orderBy(asc(chatMessages.createdAt))
          .limit(input.limit)
        : await db
          .select()
          .from(chatMessages)
          .where(and(...conditions))
          .orderBy(desc(chatMessages.createdAt))
          .limit(input.limit)
          .then((messages) => messages.reverse());

      const reactionsByMessage = await listReactionsForMessages(rows.map((row) => row.id), principal);
      const replyCounts = await listReplyCounts(
        rows.filter((row) => row.threadRootMessageId == null).map((row) => row.id),
      );
      const deliveryBySourceMessage = conversation.kind === "dm"
        ? await listLatestDeliveryBySourceMessageIds(
          rows
            .filter((row) => row.authorUserId != null)
            .map((row) => row.id),
        )
        : new Map<string, ChatMessageDelivery>();

      return rows.map((row) => ({
        ...row,
        reactions: reactionsByMessage.get(row.id) ?? [],
        replyCount: row.threadRootMessageId == null ? (replyCounts.get(row.id) ?? 0) : undefined,
        delivery: row.authorUserId ? (deliveryBySourceMessage.get(row.id) ?? null) : null,
      }));
    },

    createMessage: async (input: CreateChatMessageInput, principal: ChatPrincipal) => {
      const conversation = await getConversationById(input.conversationId);
      if (!conversation || conversation.companyId !== input.companyId) {
        throw notFound("Conversation not found");
      }
      const canAccess = await ensurePrincipalConversationAccess(conversation, principal);
      if (!canAccess) throw notFound("Conversation not found");
      if (conversation.kind === "channel" && conversation.archivedAt) {
        throw conflict("Cannot post to archived channel");
      }

      const normalizedThreadRoot = await resolveThreadRootMessageId(
        input.conversationId,
        input.threadRootMessageId,
      );

      const [message] = await db
        .insert(chatMessages)
        .values({
          conversationId: input.conversationId,
          companyId: input.companyId,
          threadRootMessageId: normalizedThreadRoot,
          authorAgentId: input.authorAgentId ?? null,
          authorUserId: input.authorUserId ?? null,
          body: input.body,
        })
        .returning();

      const now = new Date();
      await db
        .update(chatConversations)
        .set({
          lastMessageAt: message.createdAt,
          updatedAt: now,
        })
        .where(eq(chatConversations.id, input.conversationId));

      await upsertReadState({
        conversationId: input.conversationId,
        companyId: input.companyId,
        principalType: principal.principalType,
        principalId: principal.principalId,
        lastReadMessageId: message.id,
        lastReadAt: message.createdAt,
      });

      return {
        ...message,
        reactions: [],
        replyCount: 0,
      } satisfies ChatMessage;
    },

    hardDeleteMessage: async (messageId: string) => {
      const existing = await getMessageById(messageId);
      if (!existing) throw notFound("Message not found");

      const related = existing.threadRootMessageId
        ? [existing.id]
        : await db
          .select({ id: chatMessages.id })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.conversationId, existing.conversationId),
              or(
                eq(chatMessages.id, existing.id),
                eq(chatMessages.threadRootMessageId, existing.id),
              )!,
            ),
          )
          .then((rows) => rows.map((row) => row.id));
      const messageIds = [...new Set(related)];
      const replyMessageIds = existing.threadRootMessageId
        ? []
        : messageIds.filter((id) => id !== existing.id);
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(chatReadStates)
          .set({
            lastReadMessageId: null,
            updatedAt: now,
          })
          .where(inArray(chatReadStates.lastReadMessageId, messageIds));

        if (replyMessageIds.length > 0) {
          await tx
            .delete(chatMessages)
            .where(inArray(chatMessages.id, replyMessageIds));
        }

        await tx
          .delete(chatMessages)
          .where(eq(chatMessages.id, existing.id));

        const latestRemaining = await tx
          .select({ createdAt: chatMessages.createdAt })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.conversationId, existing.conversationId),
              isNull(chatMessages.deletedAt),
            ),
          )
          .orderBy(desc(chatMessages.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        await tx
          .update(chatConversations)
          .set({
            lastMessageAt: latestRemaining?.createdAt ?? null,
            updatedAt: now,
          })
          .where(eq(chatConversations.id, existing.conversationId));
      });

      return {
        deletedMessage: existing,
        deletedMessageIds: messageIds,
      };
    },

    addReaction: async (
      messageId: string,
      principal: ChatPrincipal,
      emoji: string,
    ) => {
      const message = await getMessageById(messageId);
      if (!message) throw notFound("Message not found");
      const conversation = await getConversationById(message.conversationId);
      if (!conversation) throw notFound("Conversation not found");
      const canAccess = await ensurePrincipalConversationAccess(conversation, principal);
      if (!canAccess) throw notFound("Message not found");

      const inserted = await db
        .insert(chatMessageReactions)
        .values({
          messageId,
          conversationId: message.conversationId,
          companyId: message.companyId,
          emoji,
          principalType: principal.principalType,
          principalId: principal.principalId,
        })
        .onConflictDoNothing()
        .returning()
        .then((rows) => rows[0] ?? null);

      const reactions = await listReactionsForMessages([messageId], principal);
      return {
        message,
        inserted: Boolean(inserted),
        reactions: reactions.get(messageId) ?? [],
      };
    },

    removeReaction: async (
      messageId: string,
      principal: ChatPrincipal,
      emoji: string,
    ) => {
      const message = await getMessageById(messageId);
      if (!message) throw notFound("Message not found");
      const conversation = await getConversationById(message.conversationId);
      if (!conversation) throw notFound("Conversation not found");
      const canAccess = await ensurePrincipalConversationAccess(conversation, principal);
      if (!canAccess) throw notFound("Message not found");

      const removed = await db
        .delete(chatMessageReactions)
        .where(
          and(
            eq(chatMessageReactions.messageId, messageId),
            eq(chatMessageReactions.emoji, emoji),
            eq(chatMessageReactions.principalType, principal.principalType),
            eq(chatMessageReactions.principalId, principal.principalId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);

      const reactions = await listReactionsForMessages([messageId], principal);
      return {
        message,
        removed: Boolean(removed),
        reactions: reactions.get(messageId) ?? [],
      };
    },

    markRead: async (
      conversationId: string,
      companyId: string,
      principal: ChatPrincipal,
      lastReadMessageId?: string | null,
    ) => {
      const conversation = await getConversationById(conversationId);
      if (!conversation || conversation.companyId !== companyId) {
        throw notFound("Conversation not found");
      }
      const canAccess = await ensurePrincipalConversationAccess(conversation, principal);
      if (!canAccess) throw notFound("Conversation not found");

      let lastReadAt = new Date();
      if (lastReadMessageId) {
        const message = await db
          .select({ id: chatMessages.id, createdAt: chatMessages.createdAt })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.id, lastReadMessageId),
              eq(chatMessages.conversationId, conversationId),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!message) throw notFound("Read message not found");
        lastReadAt = message.createdAt;
      }

      return upsertReadState({
        conversationId,
        companyId,
        principalType: principal.principalType,
        principalId: principal.principalId,
        lastReadMessageId: lastReadMessageId ?? null,
        lastReadAt,
      });
    },

    getConversationParticipants: getParticipantsByConversationId,

    findMentionedAgents: async (
      companyId: string,
      body: string,
      explicitMentionAgentIds: string[] = [],
    ) => {
      return findMentionedAgentIds(companyId, body, explicitMentionAgentIds);
    },

    resolveWakeTargetsForMessage: async (input: {
      conversationId: string;
      companyId: string;
      conversationKind: "channel" | "dm";
      body: string;
      explicitMentionAgentIds?: string[];
      senderAgentId?: string | null;
    }) => {
      const explicitMentionAgentIds = input.explicitMentionAgentIds ?? [];
      const senderAgentId = input.senderAgentId ?? null;
      const mentionedAgentIds = await findMentionedAgentIds(
        input.companyId,
        input.body,
        explicitMentionAgentIds,
      );
      const mentionedSet = new Set(mentionedAgentIds);

      if (input.conversationKind === "dm") {
        const participants = await getParticipantsByConversationId(input.conversationId);
        const targets = participants
          .filter((participant) => participant.principalType === "agent")
          .map((participant) => participant.principalId)
          .filter((agentId) => !senderAgentId || agentId !== senderAgentId)
          .map((agentId) => ({
            agentId,
            isExplicitMention: mentionedSet.has(agentId),
            wakeReason: "chat_mentioned" as const,
            route: "dm_participant" as const,
            relevanceScore: 1,
          }));

        return {
          mentionedAgentIds,
          wakeTargets: targets,
        };
      }

      const allAgents = await db
        .select({
          id: agents.id,
          name: agents.name,
          role: agents.role,
          title: agents.title,
          capabilities: agents.capabilities,
          status: agents.status,
        })
        .from(agents)
        .where(eq(agents.companyId, input.companyId));

      const messageTokens = tokenizeForRelevance(input.body);
      const messageTokenSet = new Set(messageTokens);
      const invokableStatuses = new Set(["active", "idle", "running", "error"]);

      const wakeTargets: Array<{
        agentId: string;
        isExplicitMention: boolean;
        wakeReason: "chat_mentioned" | "chat_message";
        route: "mention" | "relevance";
        relevanceScore: number;
      }> = [];

      for (const agent of allAgents) {
        if (senderAgentId && agent.id === senderAgentId) continue;

        const isExplicitMention = mentionedSet.has(agent.id);
        if (!isExplicitMention && !invokableStatuses.has(agent.status)) continue;

        const relevanceScore = scoreAgentRelevance(
          {
            role: agent.role,
            name: agent.name,
            title: agent.title,
            capabilities: agent.capabilities,
          },
          messageTokens,
          messageTokenSet,
        );
        const boostedScore = Math.min(1.5, relevanceScore + (isExplicitMention ? 1 : 0));
        if (!isExplicitMention && boostedScore < CHAT_RELEVANCE_THRESHOLD) continue;

        wakeTargets.push({
          agentId: agent.id,
          isExplicitMention,
          wakeReason: isExplicitMention ? "chat_mentioned" : "chat_message",
          route: isExplicitMention ? "mention" : "relevance",
          relevanceScore: Number(boostedScore.toFixed(4)),
        });
      }

      wakeTargets.sort((left, right) => right.relevanceScore - left.relevanceScore);

      return {
        mentionedAgentIds,
        wakeTargets,
      };
    },

    searchMessages: async (input: SearchChatInput): Promise<ChatSearchResult[]> => {
      const visibilityCondition = input.principal.isBoard
        ? sql`TRUE`
        : input.principal.principalType === "agent"
          ? sql`
              ${chatConversations.kind} = 'channel'
              OR EXISTS (
                SELECT 1
                FROM ${chatConversationParticipants}
                WHERE ${chatConversationParticipants.conversationId} = ${chatConversations.id}
                  AND ${chatConversationParticipants.principalType} = ${input.principal.principalType}
                  AND ${chatConversationParticipants.principalId} = ${input.principal.principalId}
              )
            `
          : sql`
              EXISTS (
                SELECT 1
                FROM ${chatConversationParticipants}
                WHERE ${chatConversationParticipants.conversationId} = ${chatConversations.id}
                  AND ${chatConversationParticipants.principalType} = ${input.principal.principalType}
                  AND ${chatConversationParticipants.principalId} = ${input.principal.principalId}
              )
            `;

      const tsVector = sql`to_tsvector('english', ${chatMessages.body})`;
      const tsQuery = sql`websearch_to_tsquery('english', ${input.q})`;

      const conditions = [
        eq(chatMessages.companyId, input.companyId),
        isNull(chatMessages.deletedAt),
        eq(chatConversations.companyId, input.companyId),
        visibilityCondition,
        sql`${tsVector} @@ ${tsQuery}`,
      ];

      if (input.conversationId) {
        conditions.push(eq(chatMessages.conversationId, input.conversationId));
      }

      const rows = await db
        .select({
          conversationId: chatMessages.conversationId,
          messageId: chatMessages.id,
          threadRootMessageId: chatMessages.threadRootMessageId,
          conversationKind: chatConversations.kind,
          conversationName: chatConversations.name,
          rank: sql<number>`ts_rank(${tsVector}, ${tsQuery})`,
          snippet: sql<string>`ts_headline('english', ${chatMessages.body}, ${tsQuery}, 'MaxFragments=2, MinWords=3, MaxWords=16')`,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .innerJoin(chatConversations, eq(chatConversations.id, chatMessages.conversationId))
        .where(and(...conditions))
        .orderBy(
          desc(sql<number>`ts_rank(${tsVector}, ${tsQuery})`),
          desc(chatMessages.createdAt),
        )
        .limit(input.limit);

      return rows.map((row) => ({
        conversationId: row.conversationId,
        messageId: row.messageId,
        threadRootMessageId: row.threadRootMessageId,
        conversationKind: row.conversationKind as "channel" | "dm",
        conversationName: row.conversationName,
        snippet: row.snippet,
        rank: Number(row.rank ?? 0),
        createdAt: row.createdAt,
      }));
    },
  };
}
