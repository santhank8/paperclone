import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { chatRooms } from "./chat_rooms.js";
import { agents } from "./agents.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    chatRoomId: uuid("chat_room_id").notNull().references(() => chatRooms.id),
    authorAgentId: uuid("author_agent_id").references(() => agents.id),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    runId: uuid("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roomCreatedIdx: index("chat_messages_room_created_idx").on(table.chatRoomId, table.createdAt),
    companyIdx: index("chat_messages_company_idx").on(table.companyId),
  }),
);
