import { type AnyPgColumn, pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatConversations } from "./chat_conversations.js";
import { agents } from "./agents.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    threadRootMessageId: uuid("thread_root_message_id").references((): AnyPgColumn => chatMessages.id),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id"),
    deletedByAgentId: uuid("deleted_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationCreatedIdx: index("chat_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    conversationThreadCreatedIdx: index("chat_messages_conversation_thread_created_idx").on(
      table.conversationId,
      table.threadRootMessageId,
      table.createdAt,
    ),
    companyCreatedIdx: index("chat_messages_company_created_idx").on(table.companyId, table.createdAt),
    companyConversationIdx: index("chat_messages_company_conversation_idx").on(
      table.companyId,
      table.conversationId,
    ),
  }),
);
