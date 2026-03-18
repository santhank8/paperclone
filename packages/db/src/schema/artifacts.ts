import { pgTable, uuid, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  agentId: uuid("agent_id").references(() => agents.id),
  issueId: uuid("issue_id").references(() => issues.id),
  heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
  type: text("type").notNull(), // "file", "pr", "document", "config", "report"
  name: text("name").notNull(),
  description: text("description"),
  contentType: text("content_type"), // MIME type for files
  contentText: text("content_text"), // text content (markdown, json, etc.)
  contentRef: text("content_ref"), // external reference (URL, path, SHA)
  sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("active"), // "active", "archived", "deleted"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdx: index("artifacts_company_idx").on(table.companyId),
  agentIdx: index("artifacts_agent_idx").on(table.companyId, table.agentId),
  issueIdx: index("artifacts_issue_idx").on(table.issueId),
  typeIdx: index("artifacts_type_idx").on(table.companyId, table.type),
}));
