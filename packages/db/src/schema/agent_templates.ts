import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const agentTemplates = pgTable(
  "agent_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    stageCompatibility: jsonb("stage_compatibility").$type<string[]>().notNull().default([]),
    defaultRole: text("default_role").notNull(),
    defaultTitle: text("default_title").notNull(),
    defaultResponsibilities: jsonb("default_responsibilities").$type<string[]>().notNull().default([]),
    allowedActions: jsonb("allowed_actions").$type<string[]>().notNull().default([]),
    requiredConnectors: jsonb("required_connectors").$type<string[]>().notNull().default([]),
    defaultApprovalMode: text("default_approval_mode").notNull().default("not_needed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_templates_company_id_idx").on(table.companyId),
    keyIdx: index("agent_templates_key_idx").on(table.key),
  }),
);
