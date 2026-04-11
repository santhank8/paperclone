CREATE TABLE "blog_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"issue_id" uuid,
	"topic" text NOT NULL,
	"lane" text DEFAULT 'publish' NOT NULL,
	"target_site" text DEFAULT 'fluxaivory.com' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"approval_mode" text DEFAULT 'manual' NOT NULL,
	"publish_mode" text DEFAULT 'draft' NOT NULL,
	"wordpress_post_id" bigint,
	"published_url" text,
	"approval_key_hash" text,
	"publish_idempotency_key" text,
	"context_json" jsonb,
	"failed_reason" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_run_step_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"worker_agent_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"result_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"step_attempt_id" uuid,
	"step_key" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_kind" text DEFAULT 'local_fs' NOT NULL,
	"storage_path" text,
	"body_preview" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_publish_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"target_slug" text NOT NULL,
	"site_id" text DEFAULT 'fluxaivory.com' NOT NULL,
	"artifact_hash" text NOT NULL,
	"normalized_dom_hash" text NOT NULL,
	"policy_version" text DEFAULT 'publish-gateway-v1' NOT NULL,
	"approval_key_hash" text NOT NULL,
	"approval_payload" jsonb,
	"approved_by_agent_id" uuid,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_publish_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blog_run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"site_id" text NOT NULL,
	"target_slug" text NOT NULL,
	"publish_idempotency_key" text NOT NULL,
	"wordpress_post_id" bigint,
	"published_url" text,
	"result_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_runs" ADD CONSTRAINT "blog_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_runs" ADD CONSTRAINT "blog_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_runs" ADD CONSTRAINT "blog_runs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_run_step_attempts" ADD CONSTRAINT "blog_run_step_attempts_blog_run_id_blog_runs_id_fk" FOREIGN KEY ("blog_run_id") REFERENCES "public"."blog_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_run_step_attempts" ADD CONSTRAINT "blog_run_step_attempts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_run_step_attempts" ADD CONSTRAINT "blog_run_step_attempts_worker_agent_id_agents_id_fk" FOREIGN KEY ("worker_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_artifacts" ADD CONSTRAINT "blog_artifacts_blog_run_id_blog_runs_id_fk" FOREIGN KEY ("blog_run_id") REFERENCES "public"."blog_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_artifacts" ADD CONSTRAINT "blog_artifacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_artifacts" ADD CONSTRAINT "blog_artifacts_step_attempt_id_blog_run_step_attempts_id_fk" FOREIGN KEY ("step_attempt_id") REFERENCES "public"."blog_run_step_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_approvals" ADD CONSTRAINT "blog_publish_approvals_blog_run_id_blog_runs_id_fk" FOREIGN KEY ("blog_run_id") REFERENCES "public"."blog_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_approvals" ADD CONSTRAINT "blog_publish_approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_approvals" ADD CONSTRAINT "blog_publish_approvals_approved_by_agent_id_agents_id_fk" FOREIGN KEY ("approved_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_executions" ADD CONSTRAINT "blog_publish_executions_blog_run_id_blog_runs_id_fk" FOREIGN KEY ("blog_run_id") REFERENCES "public"."blog_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_executions" ADD CONSTRAINT "blog_publish_executions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_publish_executions" ADD CONSTRAINT "blog_publish_executions_approval_id_blog_publish_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."blog_publish_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_runs_company_status_idx" ON "blog_runs" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "blog_runs_company_project_created_idx" ON "blog_runs" USING btree ("company_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_runs_issue_idx" ON "blog_runs" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_runs_publish_idempotency_uq" ON "blog_runs" USING btree ("publish_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_run_step_attempts_run_step_attempt_uq" ON "blog_run_step_attempts" USING btree ("blog_run_id","step_key","attempt_number");--> statement-breakpoint
CREATE INDEX "blog_run_step_attempts_company_status_idx" ON "blog_run_step_attempts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "blog_run_step_attempts_run_step_idx" ON "blog_run_step_attempts" USING btree ("blog_run_id","step_key");--> statement-breakpoint
CREATE INDEX "blog_artifacts_run_step_idx" ON "blog_artifacts" USING btree ("blog_run_id","step_key");--> statement-breakpoint
CREATE INDEX "blog_artifacts_company_kind_idx" ON "blog_artifacts" USING btree ("company_id","artifact_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_publish_approvals_run_key_uq" ON "blog_publish_approvals" USING btree ("blog_run_id","approval_key_hash");--> statement-breakpoint
CREATE INDEX "blog_publish_approvals_run_revoked_idx" ON "blog_publish_approvals" USING btree ("blog_run_id","revoked_at");--> statement-breakpoint
CREATE INDEX "blog_publish_approvals_company_approved_idx" ON "blog_publish_approvals" USING btree ("company_id","approved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_publish_executions_idempotency_uq" ON "blog_publish_executions" USING btree ("publish_idempotency_key");--> statement-breakpoint
CREATE INDEX "blog_publish_executions_run_idx" ON "blog_publish_executions" USING btree ("blog_run_id");--> statement-breakpoint
CREATE INDEX "blog_publish_executions_approval_idx" ON "blog_publish_executions" USING btree ("approval_id");
