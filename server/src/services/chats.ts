import type { Db } from "@paperclipai/db";
import { agentChats, agentChatMessages } from "@paperclipai/db";
import { and, asc, desc, eq, count } from "drizzle-orm";
import { publishLiveEvent } from "./live-events.js";

const CHAT_CONTEXT_WINDOW = 50;

export function chatService(db: Db) {
  async function createChat(input: {
    companyId: string;
    agentId: string;
    initiatedByUserId: string;
  }) {
    const [chat] = await db
      .insert(agentChats)
      .values({
        companyId: input.companyId,
        agentId: input.agentId,
        initiatedByUserId: input.initiatedByUserId,
        status: "active",
      })
      .returning();
    return chat;
  }

  async function listChats(companyId: string, agentId: string) {
    return db
      .select()
      .from(agentChats)
      .where(and(eq(agentChats.companyId, companyId), eq(agentChats.agentId, agentId)))
      .orderBy(desc(agentChats.updatedAt));
  }

  async function getChat(chatId: string, companyId: string) {
    const [chat] = await db
      .select()
      .from(agentChats)
      .where(and(eq(agentChats.id, chatId), eq(agentChats.companyId, companyId)));
    return chat ?? null;
  }

  async function updateChat(
    chatId: string,
    companyId: string,
    updates: { title?: string; status?: string },
  ) {
    const [updated] = await db
      .update(agentChats)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agentChats.id, chatId), eq(agentChats.companyId, companyId)))
      .returning();

    if (updated) {
      publishLiveEvent({
        companyId,
        type: "agent.chat.updated",
        payload: { chatId, agentId: updated.agentId, ...updates },
      });
    }
    return updated ?? null;
  }

  async function getMessages(chatId: string, companyId: string) {
    return db
      .select()
      .from(agentChatMessages)
      .where(and(eq(agentChatMessages.chatId, chatId), eq(agentChatMessages.companyId, companyId)))
      .orderBy(asc(agentChatMessages.createdAt));
  }

  async function getContextMessages(chatId: string) {
    // Last N messages ordered ascending (oldest first) for agent context injection
    const rows = await db
      .select()
      .from(agentChatMessages)
      .where(eq(agentChatMessages.chatId, chatId))
      .orderBy(desc(agentChatMessages.createdAt))
      .limit(CHAT_CONTEXT_WINDOW);
    return rows.reverse();
  }

  async function addUserMessage(input: {
    companyId: string;
    chatId: string;
    body: string;
  }) {
    const [msg] = await db
      .insert(agentChatMessages)
      .values({
        companyId: input.companyId,
        chatId: input.chatId,
        role: "user",
        body: input.body,
      })
      .returning();

    // Auto-title the chat from first message if untitled
    const chat = await getChat(input.chatId, input.companyId);
    if (chat && !chat.title) {
      const autoTitle = input.body.slice(0, 60).trim();
      await db
        .update(agentChats)
        .set({ title: autoTitle, updatedAt: new Date() })
        .where(eq(agentChats.id, input.chatId));
    } else {
      // Touch updatedAt to keep the chat sorted at top
      await db
        .update(agentChats)
        .set({ updatedAt: new Date() })
        .where(eq(agentChats.id, input.chatId));
    }

    publishLiveEvent({
      companyId: input.companyId,
      type: "agent.chat.message",
      payload: {
        chatId: input.chatId,
        messageId: msg.id,
        role: "user",
        agentId: chat?.agentId,
      },
    });

    return msg;
  }

  async function addAgentMessage(input: {
    companyId: string;
    chatId: string;
    body: string;
    runId?: string;
  }) {
    const [msg] = await db
      .insert(agentChatMessages)
      .values({
        companyId: input.companyId,
        chatId: input.chatId,
        role: "agent",
        body: input.body,
        runId: input.runId ?? null,
      })
      .returning();

    await db
      .update(agentChats)
      .set({ updatedAt: new Date() })
      .where(eq(agentChats.id, input.chatId));

    const chat = await getChat(input.chatId, input.companyId);

    publishLiveEvent({
      companyId: input.companyId,
      type: "agent.chat.message",
      payload: {
        chatId: input.chatId,
        messageId: msg.id,
        role: "agent",
        agentId: chat?.agentId,
        runId: input.runId,
      },
    });

    return msg;
  }

  return {
    createChat,
    listChats,
    getChat,
    updateChat,
    getMessages,
    getContextMessages,
    addUserMessage,
    addAgentMessage,
  };
}
