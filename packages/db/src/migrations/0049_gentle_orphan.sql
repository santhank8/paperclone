ALTER TABLE "company_profiles" ADD COLUMN "workspace_key" text;
--> statement-breakpoint
UPDATE "company_profiles"
SET "workspace_key" = CASE
  WHEN "company_id" IN (
    SELECT "id" FROM "companies" WHERE lower("name") = 'officely' OR "issue_prefix" = 'OFF'
  ) THEN 'officely'
  WHEN "company_id" IN (
    SELECT "id" FROM "companies" WHERE lower("name") = 'muster' OR "issue_prefix" = 'MUS'
  ) THEN 'muster'
  ELSE "workspace_key"
END
WHERE "workspace_key" IS NULL;
