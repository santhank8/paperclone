CREATE TABLE "brand_logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"variant" varchar(50) NOT NULL,
	"image_data" text NOT NULL,
	"prompt" text NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_typography" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"heading_family" varchar(200) NOT NULL,
	"heading_weight" integer NOT NULL,
	"heading_category" varchar(50) NOT NULL,
	"body_family" varchar(200) NOT NULL,
	"body_weight" integer NOT NULL,
	"body_category" varchar(50) NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_logos" ADD CONSTRAINT "brand_logos_questionnaire_id_brand_questionnaire_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."brand_questionnaire"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_typography" ADD CONSTRAINT "brand_typography_questionnaire_id_brand_questionnaire_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."brand_questionnaire"("id") ON DELETE no action ON UPDATE no action;