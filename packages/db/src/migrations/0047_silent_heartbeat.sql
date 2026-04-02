ALTER TABLE "heartbeat_runs" ADD COLUMN IF NOT EXISTS "action_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN IF NOT EXISTS "silent_success" boolean NOT NULL DEFAULT false;
