ALTER TABLE "company_memberships" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD COLUMN "supervisor_user_id" text;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD COLUMN "hourly_rate_cents" integer;
