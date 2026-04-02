CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"account_name" text,
	"workspace_id" text,
	"primary_email_domain" text,
	"plan_name" text,
	"account_status" text,
	"first_seen_at" timestamp with time zone,
	"owner_user_id" text,
	"hubspot_company_id" text,
	"hubspot_deal_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stripe_customer_id" text,
	"xero_contact_id" text,
	"intercom_company_id" text,
	"posthog_group_key" text,
	"internal_account_id" text,
	"attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_connectors" ADD COLUMN "config_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "data_connectors" ADD COLUMN "policy_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_profiles_company_idx" ON "customer_profiles" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_internal_account_uq" ON "customer_profiles" USING btree ("company_id","internal_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_workspace_uq" ON "customer_profiles" USING btree ("company_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_stripe_uq" ON "customer_profiles" USING btree ("company_id","stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_xero_uq" ON "customer_profiles" USING btree ("company_id","xero_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_hubspot_uq" ON "customer_profiles" USING btree ("company_id","hubspot_company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_company_posthog_uq" ON "customer_profiles" USING btree ("company_id","posthog_group_key");