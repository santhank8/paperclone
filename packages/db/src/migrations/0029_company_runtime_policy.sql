ALTER TABLE "companies"
ADD COLUMN "runtime_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;
