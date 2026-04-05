-- Channel enhancements: add pinned_message_ids to agent_channels

ALTER TABLE "agent_channels"
  ADD COLUMN IF NOT EXISTS "pinned_message_ids" jsonb NOT NULL DEFAULT '[]';
