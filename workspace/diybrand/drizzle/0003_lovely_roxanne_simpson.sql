CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"stripe_session_id" varchar(255) NOT NULL,
	"tier" varchar(20) NOT NULL,
	"paid_at" timestamp with time zone,
	"questionnaire_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_questionnaire_id_brand_questionnaire_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."brand_questionnaire"("id") ON DELETE no action ON UPDATE no action;