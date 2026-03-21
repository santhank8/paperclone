import { pgTable, uuid, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    filters: jsonb("filters").notNull().$type<{
      statuses: string[];
      priorities: string[];
      assignees: string[];
      labels: string[];
    }>(),
    groupBy: text("group_by").notNull().default("none"),
    sortField: text("sort_field").notNull().default("updated"),
    sortDirection: text("sort_direction").notNull().default("desc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("saved_views_company_idx").on(table.companyId),
  }),
);
