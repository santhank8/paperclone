# Test Cases: cowork-plugin-builder

## Should Trigger

| # | Prompt | Expected Phase |
|---|--------|---------------|
| T1 | "Build a Cowork plugin for our legal team that connects to Egnyte and Jira" | Phase 1: Discovery |
| T2 | "Create a sales plugin for Acme Corp - they use HubSpot, Slack, and Fireflies" | Phase 1: Discovery |
| T3 | "I need a plugin for our customer support workflow, we're on Intercom and Notion" | Phase 1: Discovery |
| T4 | "Make a data analytics plugin that connects to Snowflake and Databricks" | Phase 1: Discovery |
| T5 | "Build a plugin for our HR team - recruiting, onboarding, performance reviews" | Phase 1: Discovery |
| T6 | "The client wants a custom Cowork plugin for their finance department" | Phase 1: Discovery |
| T7 | "We already discussed the skills, now build the engineering-workflow plugin" | Phase 2: Build |
| T8 | "Package the sales-ops plugin as a .plugin file and post the summary" | Phase 3: Package |

## Should NOT Trigger

| # | Prompt | Why Not |
|---|--------|---------|
| N1 | "Create a skill for running database migrations" | Claude Code skill, not Cowork plugin (use highimpact-skill-builder) |
| N2 | "Help me install the sales plugin from the marketplace" | Installation, not building |
| N3 | "Write a CLAUDE.md file for our project" | CLAUDE.md authoring, not plugin building |
| N4 | "Build an MCP server for our internal API" | MCP server development, not plugin authoring |
| N5 | "Review this plugin for security issues" | Security review, not plugin creation |
