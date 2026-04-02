CREATE TABLE "agent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"stage_compatibility" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_role" text NOT NULL,
	"default_title" text NOT NULL,
	"default_responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_approval_mode" text DEFAULT 'not_needed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"primary_goal" text NOT NULL,
	"active_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision_cadence" text NOT NULL,
	"approval_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_repo" text,
	"allowed_repos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connected_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"display_name" text NOT NULL,
	"config_summary" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"linked_insight_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"source_connector_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_action" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_org_inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"issue_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_thread_id" text,
	"company_confidence" double precision,
	"work_type" text DEFAULT 'general' NOT NULL,
	"urgency" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'captured' NOT NULL,
	"raw_content" text NOT NULL,
	"structured_summary" text,
	"needs_clarification" boolean DEFAULT false NOT NULL,
	"clarification_thread_id" text,
	"clarification_question" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "virtual_org_policy_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "virtual_org_execution_target" text;--> statement-breakpoint
ALTER TABLE "agent_templates" ADD CONSTRAINT "agent_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_connectors" ADD CONSTRAINT "data_connectors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_cards" ADD CONSTRAINT "insight_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_org_inbox_items" ADD CONSTRAINT "virtual_org_inbox_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_org_inbox_items" ADD CONSTRAINT "virtual_org_inbox_items_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_templates_company_id_idx" ON "agent_templates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_templates_key_idx" ON "agent_templates" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_company_id_idx" ON "company_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "data_connectors_company_id_idx" ON "data_connectors" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "decision_logs_company_id_idx" ON "decision_logs" USING btree ("company_id","decided_at");--> statement-breakpoint
CREATE INDEX "insight_cards_company_id_idx" ON "insight_cards" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "virtual_org_inbox_items_company_id_idx" ON "virtual_org_inbox_items" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "virtual_org_inbox_items_issue_id_idx" ON "virtual_org_inbox_items" USING btree ("issue_id");