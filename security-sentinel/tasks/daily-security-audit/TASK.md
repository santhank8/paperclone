---
name: Daily Security Audit
assignee: security-lead
recurring: true
---

Run the daily security audit cycle for the Paperclip codebase.

## Procedure

1. **Delegate scans** — Assign the Vulnerability Analyst to run a full OWASP Top 10 and code vulnerability scan. Assign the Supply Chain Auditor to run dependency analysis, secret detection, and prompt injection scanning.

2. **Collect results** — Gather findings from both analysts.

3. **Triage and deduplicate** — Remove duplicate findings, verify severity ratings, and flag false positives.

4. **Produce report** — Create a consolidated security report with:
   - Executive summary (total findings by severity)
   - New findings since last scan
   - Critical/High findings requiring immediate action
   - Medium/Low findings for backlog
   - Resolved findings from previous scans

5. **Escalate** — If any Critical findings are discovered, immediately flag them to the board.

## Focus Areas

- `server/src/routes/` — API endpoints and input handling
- `server/src/middleware/` — Auth and access control
- `server/src/services/` — Business logic and agent execution
- `server/src/adapters/` — Agent adapter interfaces
- `ui/src/` — Frontend components (XSS risks)
- `packages/db/src/schema/` — Database schema and queries
- `package.json` / `pnpm-lock.yaml` — Dependencies
- `*.env*` files — Secret management
