ALTER TABLE "companies" ADD COLUMN "issue_lifecycle_webhook_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "notify_issue_creator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "notify_issue_assigner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assigned_by_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assigned_by_user_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_by_agent_id_agents_id_fk" FOREIGN KEY ("assigned_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;