---
phase: 01-compose-foundation
plan: 02
subsystem: infra
tags: [docker, docker-compose, env, configuration, secrets]

# Dependency graph
requires:
  - phase: 01-compose-foundation plan 01
    provides: parameterized docker-compose.yml with ${POSTGRES_USER}, ${POSTGRES_PASSWORD}, ${POSTGRES_DB}, USER_UID, USER_GID variables
provides:
  - Self-documenting docker/.env.template with all required and optional variables documented
  - Operator checklist: copy template to .env, fill in values, docker compose up -d
affects:
  - 01-compose-foundation (plan 03 — health checks use same compose file)
  - operators performing first deployment

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blank values for secrets — prevents accidental placeholder usage, causes clear :? guard errors on missing values"
    - "Pre-filled sensible defaults for non-secret variables (POSTGRES_USER, POSTGRES_DB, USER_UID, USER_GID)"
    - "In-file generation commands via openssl rand comments"

key-files:
  created:
    - docker/.env.template
  modified: []

key-decisions:
  - "Blank values (not placeholder strings) for secrets — operators get explicit error rather than silently using wrong value"
  - "POSTGRES_USER=paperclip and POSTGRES_DB=paperclip pre-filled as sensible defaults"
  - "USER_UID=1000 and USER_GID=1000 pre-filled matching Dockerfile ARG defaults, with warning to verify on docker-001"
  - "Optional AI provider keys documented (ANTHROPIC_API_KEY, OPENAI_API_KEY, GITHUB_TOKEN) to prepare for Phase 3"

patterns-established:
  - "Template covers all ${VAR} references from docker-compose.yml plus anticipated Plan 01 additions"

requirements-completed: [CONT-04]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 01 Plan 02: Compose Foundation — Env Template Summary

**Self-documenting docker/.env.template with 10 variables covering auth, PostgreSQL credentials, public URL, bind mount UID/GID, and optional AI provider keys**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-02T01:29:48Z
- **Completed:** 2026-04-02T01:30:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `docker/.env.template` covering every variable referenced in docker-compose.yml
- Documented generation commands (`openssl rand -hex 32` for BETTER_AUTH_SECRET, `openssl rand -hex 16` for POSTGRES_PASSWORD)
- Documented BetterAuth login failure risk if PAPERCLIP_PUBLIC_URL does not exactly match browser URL
- Documented NFS chown cost if USER_UID/USER_GID mismatch host owner, with `id` command to find correct values
- Included optional AI provider keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GITHUB_TOKEN) for Phase 3 readiness

## Variables Documented

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| BETTER_AUTH_SECRET | Yes | (blank) | Generate with `openssl rand -hex 32` |
| POSTGRES_USER | Yes | paperclip | Conventional default pre-filled |
| POSTGRES_PASSWORD | Yes | (blank) | Generate with `openssl rand -hex 16` |
| POSTGRES_DB | Yes | paperclip | Conventional default pre-filled |
| PAPERCLIP_PUBLIC_URL | Yes | (blank) | Must exactly match browser URL; BetterAuth fails silently if wrong |
| USER_UID | Yes | 1000 | Must verify with `id` on docker-001 |
| USER_GID | Yes | 1000 | Must verify with `id` on docker-001 |
| ANTHROPIC_API_KEY | Optional | (blank) | Phase 3 — Claude Code adapter |
| OPENAI_API_KEY | Optional | (blank) | Phase 3 — Codex adapter |
| GITHUB_TOKEN | Optional | (blank) | Phase 3 — gh CLI in agent containers |

**Variables with defaults pre-filled:** POSTGRES_USER, POSTGRES_DB, USER_UID, USER_GID
**Variables intentionally left blank:** BETTER_AUTH_SECRET, POSTGRES_PASSWORD, PAPERCLIP_PUBLIC_URL, all API keys

## Task Commits

1. **Task 1: Create docker/.env.template** - `14fecaf0` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified
- `docker/.env.template` — Self-documenting env variable template; copy to `.env` before `docker compose up -d`

## Decisions Made
- Blank values for secrets (not placeholder strings like `your-secret-here`) — when operators forget to fill in a value, the `:?` guards in docker-compose.yml produce a clear error rather than silently using a placeholder
- POSTGRES_USER and POSTGRES_DB pre-filled with `paperclip` since these are conventional and rarely need changing
- USER_UID/USER_GID default to 1000 matching Dockerfile ARG defaults, with explicit warning to verify on docker-001 before first deploy
- Optional AI provider keys included proactively so operators can fill them in now rather than needing another "first deploy" round in Phase 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

When deploying:
1. `cd docker && cp .env.template .env`
2. Fill in `BETTER_AUTH_SECRET` (generate with `openssl rand -hex 32`)
3. Fill in `POSTGRES_PASSWORD` (generate with `openssl rand -hex 16`)
4. Set `PAPERCLIP_PUBLIC_URL` to the exact URL used in browser (e.g., `http://192.168.1.100:3100`)
5. Run `id` on docker-001, update `USER_UID`/`USER_GID` if different from 1000
6. `docker compose up -d`

## Next Phase Readiness
- Plan 01-03 (health checks) can proceed — template is complete
- Operator deployment checklist is ready for first `docker compose up -d`
- No blockers

---
*Phase: 01-compose-foundation*
*Completed: 2026-04-02*
