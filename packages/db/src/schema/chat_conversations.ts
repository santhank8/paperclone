import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    dmParticipantKey: text("dm_participant_key"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKindLastMessageIdx: index("chat_conversations_company_kind_last_msg_idx").on(
      table.companyId,
      table.kind,
      table.lastMessageAt,
    ),
    companyArchivedIdx: index("chat_conversations_company_archived_idx").on(table.companyId, table.archivedAt),
    companySlugUniqueIdx: uniqueIndex("chat_conversations_company_slug_idx").on(table.companyId, table.slug),
    companyDmKeyUniqueIdx: uniqueIndex("chat_conversations_company_dm_key_idx").on(
      table.companyId,
      table.dmParticipantKey,
    ),
  }),
);
