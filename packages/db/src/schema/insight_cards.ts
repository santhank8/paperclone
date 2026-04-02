import { pgTable, uuid, text, timestamp, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const insightCards = pgTable(
  "insight_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    confidence: doublePrecision("confidence").notNull().default(0),
    sourceConnectorIds: jsonb("source_connector_ids").$type<string[]>().notNull().default([]),
    recommendedAction: text("recommended_action"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("insight_cards_company_id_idx").on(table.companyId, table.status),
  }),
);
