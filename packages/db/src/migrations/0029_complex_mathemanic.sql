ALTER TABLE "issue_comments" DROP CONSTRAINT "issue_comments_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_read_states" DROP CONSTRAINT "issue_read_states_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_read_states" ADD CONSTRAINT "issue_read_states_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;