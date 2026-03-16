-- Add agent hierarchy support for agent-created agents
ALTER TABLE agents ADD COLUMN parent_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN created_by_agent BOOLEAN NOT NULL DEFAULT false;

-- Index for finding child agents
CREATE INDEX agents_parent_agent_idx ON agents(parent_agent_id);
CREATE INDEX agents_created_by_agent_idx ON agents(created_by_agent);
