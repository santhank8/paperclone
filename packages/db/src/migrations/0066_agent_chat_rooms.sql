-- Agent Chat Rooms: channels, messages, and memberships.

-- Agent channels
CREATE TABLE IF NOT EXISTS "agent_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "scope_type" text NOT NULL DEFAULT 'company',
  "scope_id" text,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_channels_company_idx" ON "agent_channels" ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_channels_scope_idx" ON "agent_channels" ("company_id", "scope_type", "scope_id");

-- Channel messages
CREATE TABLE IF NOT EXISTS "channel_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "agent_channels"("id") ON DELETE CASCADE,
  "author_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "author_user_id" text,
  "body" text NOT NULL,
  "message_type" text NOT NULL DEFAULT 'message',
  "mentions" jsonb NOT NULL DEFAULT '[]',
  "linked_issue_id" uuid,
  "reply_to_id" uuid REFERENCES "channel_messages"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "channel_messages_channel_idx" ON "channel_messages" ("channel_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "channel_messages_company_idx" ON "channel_messages" ("company_id");

-- Channel memberships
CREATE TABLE IF NOT EXISTS "channel_memberships" (
  "channel_id" uuid NOT NULL REFERENCES "agent_channels"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("channel_id", "agent_id")
);
