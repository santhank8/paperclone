CREATE TABLE IF NOT EXISTS "chat_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_read_states_company_session_idx" ON "chat_read_states" USING btree ("company_id","chat_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_read_states_company_user_idx" ON "chat_read_states" USING btree ("company_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_read_states_company_session_user_idx" ON "chat_read_states" USING btree ("company_id","chat_session_id","user_id");
