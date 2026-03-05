import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatConversations } from "./chat_conversations.js";
import { chatMessages } from "./chat_messages.js";
import { agents } from "./agents.js";

export const chatDeliveryExpectations = pgTable(
  "chat_delivery_expectations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    sourceMessageId: uuid("source_message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    targetAgentId: uuid("target_agent_id").notNull().references(() => agents.id),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    timeoutAt: timestamp("timeout_at", { withTimezone: true }).notNull(),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }).notNull(),
    resolvedByMessageId: uuid("resolved_by_message_id").references(() => chatMessages.id, {
      onDelete: "set null",
    }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceTargetUniqueIdx: uniqueIndex("chat_delivery_expect_source_target_idx").on(
      table.sourceMessageId,
      table.targetAgentId,
    ),
    companyStatusNextCheckIdx: index("chat_delivery_expect_company_status_next_idx").on(
      table.companyId,
      table.status,
      table.nextCheckAt,
    ),
    conversationSourceIdx: index("chat_delivery_expect_conv_source_idx").on(
      table.conversationId,
      table.sourceMessageId,
    ),
    targetStatusNextCheckIdx: index("chat_delivery_expect_target_status_next_idx").on(
      table.targetAgentId,
      table.status,
      table.nextCheckAt,
    ),
  }),
);
