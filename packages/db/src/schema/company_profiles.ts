import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    workspaceKey: text("workspace_key"),
    stage: text("stage").notNull(),
    primaryGoal: text("primary_goal").notNull(),
    activeCapabilities: jsonb("active_capabilities").$type<string[]>().notNull().default([]),
    decisionCadence: text("decision_cadence").notNull(),
    approvalPolicy: jsonb("approval_policy").$type<Record<string, unknown>>().notNull().default({}),
    defaultRepo: text("default_repo"),
    allowedRepos: jsonb("allowed_repos").$type<string[]>().notNull().default([]),
    connectedTools: jsonb("connected_tools").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_profiles_company_id_idx").on(table.companyId),
  }),
);
