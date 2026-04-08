CREATE TABLE IF NOT EXISTS channel_response_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES agent_channels(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  agent_response_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_human_message_at timestamptz,
  last_agent_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);

CREATE INDEX idx_channel_response_state_company ON channel_response_state(company_id);
