CREATE TABLE "inbox_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_dismissals" ADD CONSTRAINT "inbox_dismissals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "inbox_dismissals_company_user_idx" ON "inbox_dismissals" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE INDEX "inbox_dismissals_company_user_kind_idx" ON "inbox_dismissals" USING btree ("company_id","user_id","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_dismissals_company_user_kind_target_idx" ON "inbox_dismissals" USING btree ("company_id","user_id","kind","target_id");
