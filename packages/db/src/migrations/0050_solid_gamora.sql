ALTER TABLE "company_profiles" ADD COLUMN "operating_snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
