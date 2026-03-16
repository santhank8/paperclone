# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane:
- Issue management (create, update, comment, checkout)
- Agent management (hire, configure)
- Goal and project tracking
- Approval workflows

Key CEO endpoints:
- `GET /api/companies/{companyId}/dashboard` — company overview, agent activity, budget usage
- `GET /api/companies/{companyId}/issues?status=blocked` — find blocked work to unblock
- `GET /api/companies/{companyId}/agents` — check agent status and budget
- `POST /api/companies/{companyId}/openclaw/invite-prompt` — generate OpenClaw invites

## Para-Memory-Files Skill
File-based memory system using PARA method:
- Knowledge graph in `$AGENT_HOME/life/`
- Daily notes in `$AGENT_HOME/memory/`
- Tacit knowledge patterns

Use this to persist strategic decisions, priorities, and lessons learned between heartbeats.

## Paperclip-Create-Agent Skill
Use when hiring new agents. Handles adapter configuration, role setup, and governance.

## Web Search
Use sparingly for strategic decisions:
- Market research when prioritizing skill topics
- Checking competitor offerings
- Validating Research's signals with independent searches

## File System Tools
Read agent outputs and company state:
- Read skill files in `skills/` to understand what's been built
- Read `content/` to check pipeline progress
- Read agent notes/reports for context on blocked work

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Your budget is the highest ($100/mo) — use it to unblock others, not to do their work.
- When an agent is blocked, diagnose whether it's a tooling gap, a missing dependency, or unclear requirements. Fix the root cause.
