CREATE TABLE IF NOT EXISTS "knowledge_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "parent_id" uuid REFERENCES "knowledge_entries"("id"),
  "type" text NOT NULL,
  "name" text NOT NULL,
  "scope" text NOT NULL,
  "scope_agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE CASCADE,
  "asset_id" uuid REFERENCES "assets"("id") ON DELETE CASCADE,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by_user_id" text,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_entries_company_scope_idx" ON "knowledge_entries" ("company_id", "scope");
CREATE INDEX IF NOT EXISTS "knowledge_entries_company_parent_idx" ON "knowledge_entries" ("company_id", "parent_id");
CREATE INDEX IF NOT EXISTS "knowledge_entries_company_scope_agent_idx" ON "knowledge_entries" ("company_id", "scope", "scope_agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_entries_document_uq" ON "knowledge_entries" ("document_id") WHERE "document_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_entries_asset_uq" ON "knowledge_entries" ("asset_id") WHERE "asset_id" IS NOT NULL;
