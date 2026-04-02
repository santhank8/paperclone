import { pgTable, uuid, text, timestamp, doublePrecision, boolean, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const virtualOrgInboxItems = pgTable(
  "virtual_org_inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"),
    sourceThreadId: text("source_thread_id"),
    companyConfidence: doublePrecision("company_confidence"),
    workType: text("work_type").notNull().default("general"),
    urgency: text("urgency").notNull().default("medium"),
    status: text("status").notNull().default("captured"),
    rawContent: text("raw_content").notNull(),
    structuredSummary: text("structured_summary"),
    needsClarification: boolean("needs_clarification").notNull().default(false),
    clarificationThreadId: text("clarification_thread_id"),
    clarificationQuestion: text("clarification_question"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("virtual_org_inbox_items_company_id_idx").on(table.companyId, table.status),
    issueIdx: index("virtual_org_inbox_items_issue_id_idx").on(table.issueId),
  }),
);
