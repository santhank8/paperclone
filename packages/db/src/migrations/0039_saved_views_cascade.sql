ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE no action;
