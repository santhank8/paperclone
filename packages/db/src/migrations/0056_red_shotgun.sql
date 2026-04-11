CREATE TABLE "heartbeat_retry_circuits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"adapter_type" text NOT NULL,
	"state" text DEFAULT 'closed' NOT NULL,
	"opened_at" timestamp with time zone,
	"open_until" timestamp with time zone,
	"next_probe_at" timestamp with time zone,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_total" integer DEFAULT 0 NOT NULL,
	"window_failures" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"cooldown_seconds" integer DEFAULT 600 NOT NULL,
	"last_failure_code" text,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD COLUMN "retry_group_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD COLUMN "retry_attempt" integer;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_group_id" uuid;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_class" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_exhausted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_blocked_reason" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_last_decision" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "retry_policy_json" jsonb;--> statement-breakpoint
ALTER TABLE "heartbeat_retry_circuits" ADD CONSTRAINT "heartbeat_retry_circuits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "heartbeat_retry_circuits_company_adapter_type_unique_idx" ON "heartbeat_retry_circuits" USING btree ("company_id","adapter_type");--> statement-breakpoint
CREATE INDEX "heartbeat_retry_circuits_company_state_idx" ON "heartbeat_retry_circuits" USING btree ("company_id","state");--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_retry_group_id_heartbeat_runs_id_fk" FOREIGN KEY ("retry_group_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_wakeup_requests_company_status_scheduled_idx" ON "agent_wakeup_requests" USING btree ("company_id","status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "heartbeat_runs_retry_group_attempt_idx" ON "heartbeat_runs" USING btree ("retry_group_id","retry_attempt") WHERE "heartbeat_runs"."retry_group_id" is not null;--> statement-breakpoint
CREATE INDEX "heartbeat_runs_retry_due_idx" ON "heartbeat_runs" USING btree ("agent_id","status","retry_scheduled_for","created_at");