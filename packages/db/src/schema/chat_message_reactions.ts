import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatConversations } from "./chat_conversations.js";
import { chatMessages } from "./chat_messages.js";

export const chatMessageReactions = pgTable(
  "chat_message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messageEmojiPrincipalUniqueIdx: uniqueIndex("chat_msg_reactions_message_emoji_principal_idx").on(
      table.messageId,
      table.emoji,
      table.principalType,
      table.principalId,
    ),
    companyMessageIdx: index("chat_msg_reactions_company_message_idx").on(table.companyId, table.messageId),
    conversationMessageIdx: index("chat_msg_reactions_conversation_message_idx").on(
      table.conversationId,
      table.messageId,
    ),
  }),
);
