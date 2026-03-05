CREATE TABLE "chat_delivery_expectations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"source_message_id" uuid NOT NULL,
	"target_agent_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"timeout_at" timestamp with time zone NOT NULL,
	"next_check_at" timestamp with time zone NOT NULL,
	"resolved_by_message_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_delivery_expectations" ADD CONSTRAINT "chat_delivery_expectations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_delivery_expectations" ADD CONSTRAINT "chat_delivery_expectations_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_delivery_expectations" ADD CONSTRAINT "chat_delivery_expectations_source_message_id_chat_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_delivery_expectations" ADD CONSTRAINT "chat_delivery_expectations_target_agent_id_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_delivery_expectations" ADD CONSTRAINT "chat_delivery_expectations_resolved_by_message_id_chat_messages_id_fk" FOREIGN KEY ("resolved_by_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_delivery_expect_source_target_idx" ON "chat_delivery_expectations" USING btree ("source_message_id","target_agent_id");
--> statement-breakpoint
CREATE INDEX "chat_delivery_expect_company_status_next_idx" ON "chat_delivery_expectations" USING btree ("company_id","status","next_check_at");
--> statement-breakpoint
CREATE INDEX "chat_delivery_expect_conv_source_idx" ON "chat_delivery_expectations" USING btree ("conversation_id","source_message_id");
--> statement-breakpoint
CREATE INDEX "chat_delivery_expect_target_status_next_idx" ON "chat_delivery_expectations" USING btree ("target_agent_id","status","next_check_at");
