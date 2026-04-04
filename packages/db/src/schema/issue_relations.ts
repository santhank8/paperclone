import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    relatedIssueId: uuid("related_issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("issue_relations_issue_idx").on(table.issueId),
    relatedIssueIdx: index("issue_relations_related_issue_idx").on(table.relatedIssueId),
    companyIdx: index("issue_relations_company_idx").on(table.companyId),
    uniqueRelation: uniqueIndex("issue_relations_unique_idx").on(table.issueId, table.relatedIssueId, table.type),
  }),
);
