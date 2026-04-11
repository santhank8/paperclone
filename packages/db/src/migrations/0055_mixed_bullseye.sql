CREATE TABLE "roadmap_epic_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"roadmap_id" text NOT NULL,
	"paused_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap_epic_pauses" ADD CONSTRAINT "roadmap_epic_pauses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_epic_pauses_company_roadmap_idx" ON "roadmap_epic_pauses" USING btree ("company_id","roadmap_id");--> statement-breakpoint
CREATE INDEX "roadmap_epic_pauses_company_idx" ON "roadmap_epic_pauses" USING btree ("company_id");
