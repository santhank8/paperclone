import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const roadmapEpicPauses = pgTable(
  "roadmap_epic_pauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    roadmapId: text("roadmap_id").notNull(),
    pausedByUserId: text("paused_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRoadmapUniqueIdx: uniqueIndex("roadmap_epic_pauses_company_roadmap_idx").on(table.companyId, table.roadmapId),
    companyIdx: index("roadmap_epic_pauses_company_idx").on(table.companyId),
  }),
);
