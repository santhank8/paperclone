import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentChats = pgTable(
  "agent_chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    initiatedByUserId: text("initiated_by_user_id").notNull(),
    title: text("title"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("agent_chats_company_agent_idx").on(table.companyId, table.agentId),
    companyUserIdx: index("agent_chats_company_user_idx").on(table.companyId, table.initiatedByUserId),
  }),
);
