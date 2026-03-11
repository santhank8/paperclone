import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const webhookIssueLinks = pgTable(
  "webhook_issue_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    issueIdx: index("webhook_issue_links_issue_idx").on(table.issueId),
    companyProviderUq: uniqueIndex("webhook_issue_links_company_provider_uq").on(
      table.companyId,
      table.provider,
      table.externalType,
      table.externalId,
    ),
  }),
);
