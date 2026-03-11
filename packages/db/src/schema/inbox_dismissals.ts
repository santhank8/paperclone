import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const inboxDismissals = pgTable(
  "inbox_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    targetId: text("target_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("inbox_dismissals_company_user_idx").on(table.companyId, table.userId),
    companyUserKindIdx: index("inbox_dismissals_company_user_kind_idx").on(
      table.companyId,
      table.userId,
      table.kind,
    ),
    companyUserKindTargetUnique: uniqueIndex("inbox_dismissals_company_user_kind_target_idx").on(
      table.companyId,
      table.userId,
      table.kind,
      table.targetId,
    ),
  }),
);
