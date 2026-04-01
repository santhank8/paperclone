CREATE TABLE IF NOT EXISTS "biller_unit_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"biller" text NOT NULL,
	"billing_type" text NOT NULL,
	"unit_type" text NOT NULL,
	"unit_price_usd" numeric(12, 8) NOT NULL,
	"plan_name" text,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "biller_unit_prices_company_biller_billing_type_from_uniq" UNIQUE("company_id","biller","billing_type","effective_from")
);
--> statement-breakpoint
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_run_id_heartbeat_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "raw_units" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "raw_unit_type" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "unit_price_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'biller_unit_prices_company_id_companies_id_fk'
      AND table_name = 'biller_unit_prices'
  ) THEN
    ALTER TABLE "biller_unit_prices" ADD CONSTRAINT "biller_unit_prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biller_unit_prices_company_biller_billing_type_from_idx" ON "biller_unit_prices" USING btree ("company_id","biller","billing_type","effective_from");
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cost_events_unit_price_id_biller_unit_prices_id_fk'
      AND table_name = 'cost_events'
  ) THEN
    ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_unit_price_id_biller_unit_prices_id_fk" FOREIGN KEY ("unit_price_id") REFERENCES "public"."biller_unit_prices"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
