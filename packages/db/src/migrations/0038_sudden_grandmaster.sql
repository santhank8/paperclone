ALTER TABLE "agents" ADD COLUMN "responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "run_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "action_count" integer;