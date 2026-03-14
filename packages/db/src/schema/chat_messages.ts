import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("chat_messages_agent_idx").on(table.agentId),
    companyIdx: index("chat_messages_company_idx").on(table.companyId),
    agentCreatedAtIdx: index("chat_messages_agent_created_at_idx").on(table.agentId, table.createdAt),
    runIdx: index("chat_messages_run_idx").on(table.runId),
  }),
);
