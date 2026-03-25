# CLAUDE.md — Context for AI Sessions

This file captures context about this project and its tooling to help Claude (and other AI assistants) pick up quickly in future sessions.

---

## Project: 247365 / Amaravati

This is the monorepo for the **247365** and **Amaravati Ltd** products. It uses pnpm workspaces.

---

## Paperclip — Local Agent Orchestration App

**Paperclip** is a local project management + AI agent orchestration tool running at:

```
http://127.0.0.1:3100
```

### Workspace IDs

| Company / Product | Workspace ID | URL Prefix | Example Agent URL |
|---|---|---|---|
| 247365.IN | `IN` | `/IN/` | `http://127.0.0.1:3100/IN/agents/ceo/configuration` |
| Amaravati Ltd | `AMA` | `/AMA/` | `http://127.0.0.1:3100/AMA/agents/ceo/configuration` |

Other workspaces visible in the sidebar (IND = india.tl, FRI = another company) — don't confuse these with the primary two above.

### Agent Configuration URL Pattern

```
http://127.0.0.1:3100/{WORKSPACE_ID}/agents/{agent-slug}/configuration
```

### Adapter Type — IMPORTANT

When configuring an agent to use Claude models:
1. **First** change "Adapter type" from `Codex (local)` → `Claude (local)`
2. **Then** the Model dropdown will populate with Claude models
3. Searching for "claude" in the Model dropdown while on `Codex (local)` returns "No models found" — this is expected

### Model Selection

> ⚠️ **Break mode (2026-03-25)**: All agents temporarily set to Haiku to save costs. Restore preferred models when development resumes.


Preferred model for all agents: **Claude Sonnet 4.6** (`claude-sonnet-4-6`)

Available Claude models (as of 2026-03):
- Claude Haiku 4.5
- Claude Haiku 4.6
- Claude Opus 4.6
- Claude Sonnet 4.5
- Claude Sonnet 4.6 ← preferred

### Heartbeat Scheduler

Instance-wide heartbeat on/off controls for all agents:

```
http://127.0.0.1:3100/instance/settings/heartbeats
```

### Agents — 247365.IN (Workspace: `IN`)

| Agent | Slug | Model | Heartbeat | Notes |
|---|---|---|---|---|
| CEO | `ceo` | claude-haiku-4-5 | ✅ active (1h) | |
| VP of Engineering | `vp-of-engineering` | claude-haiku-4-5 | ✅ active (1h) | |
| Business Analyst | `business-analyst` | claude-haiku-4-5 | ✅ active (24h) | Reports to CEO |
| Documentation Writer | `documentation-writer` | claude-haiku-4-5 | ✅ active (1h) | Reports to VP Eng |
| Bug Fixer | `bug-fixer` | claude-haiku-4-5 | ✅ active (1h) | |
| Prod QA | `prod-qa` | claude-haiku-4-5 | ✅ active (24h) | |
| DevOps Engineer | `devops-engineer` | claude-haiku-4-5 | ✅ active (1h) | |
| QA Tester | `qa-tester` | claude-haiku-4-5 | ✅ active (1h) | |
| QA Tester (Codex) | `qa-tester-codex` | gpt-5.3-codex | ⏸ off | |
| Founding Engineer | `founding-engineer` | claude-haiku-4-5 | ✅ active (15min) | |
| Local Test Runner | `local-test-runner` | claude-haiku-4-5 | ⏸ off (wakeOnDemand) | Added 2026-03-25; runs tests locally to preserve CI minutes; reports to VP of Engineering |

### Agent Workspace Folders — 247365.IN

| Agent | Workspace Path |
|---|---|
| Business Analyst | `~/.paperclip/instances/default/workspaces/16ea0cac-5ee9-467a-ab9b-f5ecacb982ba/` |
| Documentation Writer | `~/.paperclip/instances/default/workspaces/5de20a07-b2cb-4d7a-89c8-fddc199816f7/` |

Business Analyst folder structure: `docs/prds/`, `docs/research/`, `docs/templates/`, `notes/`
Documentation Writer folder structure: `docs/api-reference/`, `docs/guides/`, `docs/changelogs/`, `notes/`

### Agent Workspace Folders — CEO & VP of Engineering

| Agent | Workspace Path |
|---|---|
| CEO | `~/.paperclip/instances/default/workspaces/135aca3d-32e3-4302-943b-dcf6565f564e/` |
| VP of Engineering | `~/.paperclip/instances/default/workspaces/aea3f630-ad82-48ac-885c-f2051afdc953/` |
| Local Test Runner | `~/.paperclip/instances/default/workspaces/b5111e0c-753e-4601-8f1d-e05c310346f9/` |

### Local Test Runner — Configuration Notes

- **Agent ID**: `b5111e0c-753e-4601-8f1d-e05c310346f9`
- **Model**: `claude-haiku-4-5-20251001`
- **cwd**: `/Users/nag/work/247365`
- **Instructions file**: `/Users/nag/work/247365/AGENTS-local-test-runner.md`
- **Purpose**: Runs `pnpm vitest run` and `pnpm playwright test --grep @smoke` locally — preserves GitHub Actions CI minutes (cancelled Nightly Tests at 90% usage 2026-03-25)
- **How to trigger**: Assign a test issue to this agent via Paperclip UI "Assign Task" button — fires `issue_assigned` wake
- **Prompt template uses**: `{{ context.taskId }}` and `{{ context.wakeReason }}` — agent fetches the issue via Paperclip REST API and acts on it
- **Important**: `{{ context.inbox }}` does NOT exist in Paperclip's template context. Use `{{ context.taskId }}` instead. The context snapshot for assignment runs contains: `taskId`, `issueId`, `taskKey`, `wakeReason`, `wakeSource`, `paperclipWorkspace`
- **DB password**: `paperclip` (postgres user `paperclip`, socket `/tmp/.s.PGSQL.54329`, port 54329). `promptTemplate` is stored in `agents.adapter_config->>'promptTemplate'`

### Active PRD Work — 247365.IN

| Issue | Title | Assigned To | Status | Notes |
|---|---|---|---|---|
| IN-76 | PRD: API Testing Tool (Postman-like) with Local + Remote Endpoint Support | Business Analyst | in_review | ✅ CEO approved + ✅ VP technically approved 2026-03-23. Ready for sprint planning. |
| IN-77 | VP REVIEW REQUIRED: IN-76 PRD Technical Feasibility Assessment | VP of Engineering | done | Completed 2026-03-23; VP posted full technical review on IN-76 |

### PRD Workflow Notes

- **IN-76 PRD** is fully approved as of 2026-03-23:
  - **CEO**: Strategically approved (comment on IN-76). Resolved OQ-2 (50 req/day AI rate limit), OQ-7 (core testing free / AI features Pro/Team gated). Added "no-signup-required" differentiator.
  - **VP of Engineering**: Technically approved (verdict: "TECHNICALLY APPROVED"). Confirmed WebSocket relay architecture is sound (proven by ngrok/Cloudflare Tunnel/Hoppscotch pattern). Answered OQ-1 (open source agent), OQ-3 (CLI for V1), OQ-4 (streaming + truncation), OQ-6 (local storage V2 scope), OQ-8 (Cloudflare Durable Objects for WebSocket relay).
  - **Business Analyst**: Incorporated CEO feedback (run ba75cacc, 8:50 PM); full PRD with pricing tiers (Free / Pro $9/mo / Team $15/seat/mo), 20 user stories, 59 requirements.
- **Next step**: Close IN-76 as done (or move to sprint planning). Activate Documentation Writer heartbeat to begin API docs and guides aligned to approved PRD.
- **Agent inbox pattern**: Agents only pick up tasks via direct assignment (inbox). Use "Assign Task" in Paperclip UI on agent's dashboard → triggers immediate Assignment heartbeat. Timer/on-demand heartbeats only work if agent has HEARTBEAT.md context to check `in_review` issues proactively.

### Agents — Amaravati Ltd (Workspace: `AMA`)

| Agent | Slug | Model | Heartbeat |
|---|---|---|---|
| CEO | `ceo` | claude-sonnet-4-6 | ✅ active |
| SRE Monitor | `sre-monitor` | claude-sonnet-4-6 | ✅ active |
| Incident Responder | `incident-responder` | claude-sonnet-4-6 | ✅ active |
| Prod Support Lead | `prod-support-lead` | claude-sonnet-4-6 | ✅ active |
| Security Auditor | `security-auditor` | claude-sonnet-4-6 | ✅ active |

Note: CEO (Nemotron/openclaw) was removed 2026-03-23 — to be revisited when NemoClaw matures.

---

## GitHub Repository

- Org/Repo: `amaravati-io/247365` (private)
- Main CI: GitHub Actions Nightly Tests (Playwright E2E, 1125 tests × 1 worker)
- E2E suite takes ~3h+ to run; `reporter: 'github'` only emits `::error::` annotations for tests that fail all 3 retries
- ⚠️ Nightly Tests **disabled** 2026-03-25 (workflow ID 246077298) — CI minutes at 90% of monthly limit. Re-enable with `gh workflow enable 246077298` when CI resets. Use Local Test Runner agent for unit tests in the meantime.

---

## Key Development Notes

- Package manager: **pnpm** (workspaces)
- Run tests: see `vitest.config.ts` and `tests/` directory
- Docker: `docker-compose.yml` for local dev; `docker-compose.quickstart.yml` for quick setup
