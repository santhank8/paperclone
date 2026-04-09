import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agentChats } from "./agent_chats.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const agentChatMessages = pgTable(
  "agent_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chatId: uuid("chat_id").notNull().references(() => agentChats.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'agent'
    body: text("body").notNull(),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chatCreatedIdx: index("agent_chat_messages_chat_created_idx").on(table.chatId, table.createdAt),
  }),
);
