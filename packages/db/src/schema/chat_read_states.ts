import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatSessions } from "./chat_sessions.js";

export const chatReadStates = pgTable(
  "chat_read_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chatSessionId: uuid("chat_session_id").notNull().references(() => chatSessions.id),
    userId: text("user_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySessionIdx: index("chat_read_states_company_session_idx").on(table.companyId, table.chatSessionId),
    companyUserIdx: index("chat_read_states_company_user_idx").on(table.companyId, table.userId),
    companySessionUserUnique: uniqueIndex("chat_read_states_company_session_user_idx").on(
      table.companyId,
      table.chatSessionId,
      table.userId,
    ),
  }),
);
