import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { documents } from "./documents.js";
import { assets } from "./assets.js";

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => knowledgeEntries.id),
    type: text("type").notNull(), // 'folder' | 'document' | 'file'
    name: text("name").notNull(),
    scope: text("scope").notNull(), // 'company' | 'department' | 'agent'
    scopeAgentId: uuid("scope_agent_id").references(() => agents.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyScopeIdx: index("knowledge_entries_company_scope_idx").on(table.companyId, table.scope),
    companyParentIdx: index("knowledge_entries_company_parent_idx").on(table.companyId, table.parentId),
    companyScopeAgentIdx: index("knowledge_entries_company_scope_agent_idx").on(
      table.companyId,
      table.scope,
      table.scopeAgentId,
    ),
    documentUq: uniqueIndex("knowledge_entries_document_uq").on(table.documentId),
    assetUq: uniqueIndex("knowledge_entries_asset_uq").on(table.assetId),
  }),
);
