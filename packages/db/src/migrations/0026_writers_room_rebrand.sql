-- Migration: Rebrand from corporate to Hollywood Writers Room terminology
-- Updates existing data to use new role, approval type, invite type, and goal level values

-- Update agent roles
UPDATE agents SET role = 'showrunner' WHERE role = 'ceo';
UPDATE agents SET role = 'head_writer' WHERE role = 'cto';
UPDATE agents SET role = 'story_editor' WHERE role = 'cmo';
UPDATE agents SET role = 'script_coordinator' WHERE role = 'cfo';
UPDATE agents SET role = 'staff_writer' WHERE role = 'engineer';
UPDATE agents SET role = 'creative_consultant' WHERE role = 'designer';
UPDATE agents SET role = 'writers_assistant' WHERE role = 'pm';
UPDATE agents SET role = 'continuity_editor' WHERE role = 'qa';
UPDATE agents SET role = 'room_runner' WHERE role = 'devops';

-- Update approval types
UPDATE approvals SET type = 'onboard_writer' WHERE type = 'hire_agent';
UPDATE approvals SET type = 'approve_showrunner_vision' WHERE type = 'approve_ceo_strategy';

-- Update goal levels
UPDATE goals SET level = 'production' WHERE level = 'company';
UPDATE goals SET level = 'room' WHERE level = 'team';
UPDATE goals SET level = 'writer' WHERE level = 'agent';
UPDATE goals SET level = 'assignment' WHERE level = 'task';

-- Update invite types
UPDATE invites SET invite_type = 'production_join' WHERE invite_type = 'company_join';
UPDATE invites SET invite_type = 'bootstrap_showrunner' WHERE invite_type = 'bootstrap_ceo';

-- Update default for invites table
ALTER TABLE invites ALTER COLUMN invite_type SET DEFAULT 'production_join';
