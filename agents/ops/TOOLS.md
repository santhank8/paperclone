# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Shell & Scripting
Write and execute automation scripts:
- Bash/zsh scripts for repeatable operational tasks
- `bun` for TypeScript-based automation scripts
- Environment variable management
- Log parsing and inspection
- Store all scripts in `ops/scripts/` with descriptive names

## Git & GitHub (`gh` CLI)
Manage code and CI/CD:
- `gh` CLI for all GitHub operations (PRs, Actions, releases)
- `gh run list` / `gh run view` to inspect CI pipeline status
- `gh workflow run` to trigger workflows manually
- Never use raw GitHub URLs — always `gh api`

## Vercel CLI
Deployment management for aiskillslab.dev:
- `vercel` for preview deployments
- `vercel --prod` for production (requires explicit task instruction)
- `vercel logs` to diagnose deployment failures
- `vercel env` to manage environment variables

## System Health Checks
Monitor infrastructure directly:
- `curl -s http://localhost:3100/api/health` — Paperclip server
- `curl -s http://localhost:8891/health` — Hindsight
- `curl -s http://localhost:3000` — Website dev server
- Check process health: `pgrep -fl paperclip`, `pgrep -fl next`

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Understand root cause before executing a fix. Document what broke and why.
- Update runbooks in `ops/docs/` after any non-obvious incident resolution.
- Production deploys require explicit instruction — default to preview.
