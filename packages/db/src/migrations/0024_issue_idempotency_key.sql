ALTER TABLE "issues" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE INDEX "issues_company_idempotency_key_idx" ON "issues" USING btree ("company_id","idempotency_key") WHERE "issues"."idempotency_key" IS NOT NULL;
