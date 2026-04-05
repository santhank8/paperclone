-- Phase 9: deliverable_status on knowledge_pages + depends_on on issues

-- Add deliverable_status to knowledge_pages
ALTER TABLE "knowledge_pages"
  ADD COLUMN IF NOT EXISTS "deliverable_status" text;

-- Add index for fast deliverable queries
CREATE INDEX IF NOT EXISTS "knowledge_pages_company_deliverable_idx"
  ON "knowledge_pages" ("company_id", "deliverable_status")
  WHERE "deliverable_status" IS NOT NULL;

-- Add depends_on to issues (JSONB array of issue IDs)
ALTER TABLE "issues"
  ADD COLUMN IF NOT EXISTS "depends_on" jsonb NOT NULL DEFAULT '[]';

-- Add target_date to issues for deadline tracking
ALTER TABLE "issues"
  ADD COLUMN IF NOT EXISTS "target_date" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "issues_company_target_date_idx"
  ON "issues" ("company_id", "target_date")
  WHERE "target_date" IS NOT NULL;
