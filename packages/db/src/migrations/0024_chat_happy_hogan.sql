CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"dm_participant_key" text,
	"archived_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_conversations_company_kind_last_msg_idx" ON "chat_conversations" USING btree ("company_id","kind","last_message_at");
--> statement-breakpoint
CREATE INDEX "chat_conversations_company_archived_idx" ON "chat_conversations" USING btree ("company_id","archived_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_company_slug_idx" ON "chat_conversations" USING btree ("company_id","slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_company_dm_key_idx" ON "chat_conversations" USING btree ("company_id","dm_participant_key");
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"thread_root_message_id" uuid,
	"author_agent_id" uuid,
	"author_user_id" text,
	"body" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"deleted_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_root_message_id_chat_messages_id_fk" FOREIGN KEY ("thread_root_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deleted_by_agent_id_agents_id_fk" FOREIGN KEY ("deleted_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_idx" ON "chat_messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_thread_created_idx" ON "chat_messages" USING btree ("conversation_id","thread_root_message_id","created_at");
--> statement-breakpoint
CREATE INDEX "chat_messages_company_created_idx" ON "chat_messages" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "chat_messages_company_conversation_idx" ON "chat_messages" USING btree ("company_id","conversation_id");
--> statement-breakpoint
CREATE INDEX "chat_messages_body_fts_idx" ON "chat_messages" USING gin (to_tsvector('english', "body")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE "chat_conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversation_participants" ADD CONSTRAINT "chat_conversation_participants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_conversation_participants" ADD CONSTRAINT "chat_conversation_participants_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conv_participants_conv_principal_idx" ON "chat_conversation_participants" USING btree ("conversation_id","principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "chat_conv_participants_company_principal_idx" ON "chat_conversation_participants" USING btree ("company_id","principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "chat_conv_participants_company_conv_idx" ON "chat_conversation_participants" USING btree ("company_id","conversation_id");
--> statement-breakpoint
CREATE TABLE "chat_message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_msg_reactions_message_emoji_principal_idx" ON "chat_message_reactions" USING btree ("message_id","emoji","principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "chat_msg_reactions_company_message_idx" ON "chat_message_reactions" USING btree ("company_id","message_id");
--> statement-breakpoint
CREATE INDEX "chat_msg_reactions_conversation_message_idx" ON "chat_message_reactions" USING btree ("conversation_id","message_id");
--> statement-breakpoint
CREATE TABLE "chat_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"principal_type" text NOT NULL,
	"principal_id" text NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_read_states" ADD CONSTRAINT "chat_read_states_last_read_message_id_chat_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_read_states_conversation_principal_idx" ON "chat_read_states" USING btree ("conversation_id","principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "chat_read_states_company_principal_idx" ON "chat_read_states" USING btree ("company_id","principal_type","principal_id");
--> statement-breakpoint
CREATE INDEX "chat_read_states_company_conversation_idx" ON "chat_read_states" USING btree ("company_id","conversation_id");
--> statement-breakpoint
INSERT INTO "chat_conversations" ("company_id", "kind", "name", "slug")
SELECT "id", 'channel', 'general', 'general'
FROM "companies"
WHERE NOT EXISTS (
	SELECT 1
	FROM "chat_conversations"
	WHERE "chat_conversations"."company_id" = "companies"."id"
		AND "chat_conversations"."slug" = 'general'
);
