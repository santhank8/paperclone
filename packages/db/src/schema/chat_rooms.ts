import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    kind: text("kind").notNull(), // 'direct' | 'boardroom'
    agentId: uuid("agent_id").references(() => agents.id), // set for direct rooms
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKindIdx: index("chat_rooms_company_kind_idx").on(table.companyId, table.kind),
    companyAgentUq: uniqueIndex("chat_rooms_company_agent_uq")
      .on(table.companyId, table.agentId)
      .where(sql`${table.agentId} IS NOT NULL`),
    companyBoardroomUq: uniqueIndex("chat_rooms_company_boardroom_uq")
      .on(table.companyId)
      .where(sql`${table.kind} = 'boardroom'`),
  }),
);
