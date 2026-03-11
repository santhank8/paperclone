import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const webhookConfigs = pgTable(
  "webhook_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("github"),
    token: text("token").notNull(),
    secret: text("secret"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("webhook_configs_company_idx").on(table.companyId),
    projectIdx: index("webhook_configs_project_idx").on(table.projectId),
    tokenUq: uniqueIndex("webhook_configs_token_uq").on(table.token),
    companyNameUq: uniqueIndex("webhook_configs_company_name_uq").on(table.companyId, table.name),
  }),
);
