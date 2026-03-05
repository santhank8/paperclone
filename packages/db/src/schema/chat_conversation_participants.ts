import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatConversations } from "./chat_conversations.js";

export const chatConversationParticipants = pgTable(
  "chat_conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationPrincipalUniqueIdx: uniqueIndex("chat_conv_participants_conv_principal_idx").on(
      table.conversationId,
      table.principalType,
      table.principalId,
    ),
    companyPrincipalIdx: index("chat_conv_participants_company_principal_idx").on(
      table.companyId,
      table.principalType,
      table.principalId,
    ),
    companyConversationIdx: index("chat_conv_participants_company_conv_idx").on(
      table.companyId,
      table.conversationId,
    ),
  }),
);
