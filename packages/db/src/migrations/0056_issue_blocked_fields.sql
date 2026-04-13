ALTER TABLE "issues" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "blocked_until" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "blocked_at" timestamp with time zone;
