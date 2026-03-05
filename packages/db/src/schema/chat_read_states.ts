import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatConversations } from "./chat_conversations.js";
import { chatMessages } from "./chat_messages.js";

export const chatReadStates = pgTable(
  "chat_read_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    lastReadMessageId: uuid("last_read_message_id").references(() => chatMessages.id),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationPrincipalUniqueIdx: uniqueIndex("chat_read_states_conversation_principal_idx").on(
      table.conversationId,
      table.principalType,
      table.principalId,
    ),
    companyPrincipalIdx: index("chat_read_states_company_principal_idx").on(
      table.companyId,
      table.principalType,
      table.principalId,
    ),
    companyConversationIdx: index("chat_read_states_company_conversation_idx").on(
      table.companyId,
      table.conversationId,
    ),
  }),
);
