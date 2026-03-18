ALTER TABLE "agents" ADD COLUMN "reports_to_user_id" text;
ALTER TABLE "company_memberships" ADD COLUMN "supervisor_agent_id" text;
