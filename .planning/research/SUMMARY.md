# Project Research Summary

**Project:** Paperclip AI — Docker Compose Production Deployment
**Domain:** Brownfield Docker Compose deployment of a Node.js + PostgreSQL AI agent orchestration platform
**Researched:** 2026-04-01
**Confidence:** HIGH (all findings from direct codebase inspection)

## Executive Summary

Paperclip AI is an existing, production-grade Node.js monorepo that orchestrates AI coding agents (Claude Code, Codex, Cursor, Gemini, OpenCode) on behalf of engineering teams. The application stack is fully decided — Node.js, React, PostgreSQL, Drizzle ORM, pnpm, BetterAuth. This deployment project is narrowly scoped: make the existing `docker/docker-compose.yml` production-ready for a private team (5-20 agents) by hardening what is already there rather than building anything new. The codebase ships a functional but incomplete Compose setup; the work is filling the gaps.

The recommended approach is to start with the existing two-service topology (db + server) and close five concrete gaps in order: add a server HEALTHCHECK, wire the `BETTER_AUTH_SECRET` deployment runbook, close the PostgreSQL network exposure, set `PAPERCLIP_MIGRATION_AUTO_APPLY=true` explicitly, and document volume lifecycle discipline. The server already handles migrations on boot via `ensureMigrations()` — no init container is needed. The server container serves the React UI directly (`SERVE_UI=true`) — no Nginx required. SSL/TLS termination, monitoring, and reverse proxy are explicitly out of scope for this milestone.

The primary risks are operational rather than architectural: a hardcoded insecure default for `BETTER_AUTH_SECRET` in the source code (the compose guard catches this but the runbook must enforce it), the database port being exposed on all network interfaces, and named Docker volumes being silently destroyed by `docker compose down -v`. All three are preventable with known solutions and must be addressed before the deployment is accessible from outside localhost.

---

## Key Findings

### Recommended Stack

This is a brownfield deployment — the application stack is fixed. The deployment stack (already in the repo) is also effectively fixed and correct: `node:lts-trixie-slim` for the server image (Debian-based, required for `apt`-installed tools including `gh`, `gosu`, `ripgrep`) and `postgres:17-alpine` for the database. Switching to Alpine for the server image would break the Dockerfile; switching to `postgres:latest` risks major-version breakage.

Docker Compose v2 (Compose Spec, no `version:` key) is the correct and current orchestration layer. Kubernetes, Swarm, and Helm are out of scope and inappropriate for a single-host self-hosted deployment.

**Core technologies:**
- `node:lts-trixie-slim`: Server runtime image — must stay Debian; Dockerfile uses `apt-get` for system dependencies
- `postgres:17-alpine`: Database — current stable PostgreSQL, small Alpine image, already in use
- Docker Compose v2 (Compose Spec): Orchestration — two-service topology (db + server) is correct and sufficient
- `.env` file + compose `${VAR:?}` guards: Secrets injection — native Compose support, no Swarm or Vault required
- Named Docker volumes (`pgdata`, `paperclip-data`): Data persistence — consider bind mounts for easier backup/transfer

### Expected Features

The deployment milestone is complete when: the dashboard is browser-accessible, an admin account can be created, and agents can connect via the HTTP API. Everything else is hardening.

**Must have (table stakes):**
- PostgreSQL service with health check and named volume — server exits if database unreachable
- `BETTER_AUTH_SECRET` set in `.env` before first start — hard startup failure or silent auth bypass without it
- `DATABASE_URL` pointing to the `db` service — server falls back to embedded Postgres (wrong mode) without it
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated` and `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` — both already set in compose
- `HOST=0.0.0.0`, `PORT=3100`, `SERVE_UI=true` — already defaults in Dockerfile ENV
- `PAPERCLIP_PUBLIC_URL` set to the exact browser-visible URL — wrong value breaks BetterAuth cookie domain and CORS
- Named volume for `/paperclip` (`paperclip-data`) — all runtime state (config, secrets key, agent homes) lives here
- Port 3100 exposed to host — already in compose
- Server HEALTHCHECK — missing from Dockerfile; must be added

**Should have (production hardening):**
- `USER_UID`/`USER_GID` matching host user — prevents `chown -R` on every startup due to UID drift
- `PAPERCLIP_MIGRATION_AUTO_APPLY=true` — makes auto-migration behavior explicit; avoids edge-case startup hangs
- Restart policy `unless-stopped` on db and server — survives host reboots without manual intervention
- Database port 5432 NOT exposed to host network — currently exposed; security risk
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` wired into compose — agents inherit them without per-agent UI configuration
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true` after first admin signup — prevents open registration

**Defer (out of scope for this milestone):**
- SSL/TLS termination (PROJECT.md explicit deferral)
- Prometheus/Grafana monitoring stack
- Reverse proxy (Nginx, Traefik, Caddy)
- S3/remote storage provider
- PostgreSQL connection pool tuning (revisit when agents are active)
- Budget/cost tracking configuration
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP` (configure via UI post-deploy)

### Architecture Approach

The architecture is a two-service Docker Compose topology: a `db` container (PostgreSQL) and a `server` container (Node.js monolith). The server handles everything at the application layer — Express REST API, WebSocket live events, static React UI (via `SERVE_UI=true`), agent adapter runners (which spawn CLI child processes inside the container), Drizzle ORM migrations on boot, and BetterAuth sessions. There is no separate UI container, no CDN, no sidecar containers for agents. All local agent CLIs (`claude`, `codex`, `opencode`) are installed globally in the server image and spawned as child processes.

**Major components:**
1. `db` service — PostgreSQL 17 with `pg_isready` health check; pure data store, no application logic
2. `server` service — Node.js monolith; serves UI, handles API, runs agent adapters, applies migrations on startup
3. `pgdata` volume — PostgreSQL data files; must never be deleted with `docker compose down -v`
4. `paperclip-data` volume — app state: config, secrets encryption key, agent auth tokens, DB backups

**Key patterns the codebase already implements correctly:**
- Migration-on-boot via `ensureMigrations()` in `server/src/index.ts` — idempotent, runs before requests are served
- UID/GID remapping in `docker-entrypoint.sh` via `gosu` — prevents volume permission mismatches on Linux
- `/health` endpoint at `GET :3100/health` — returns `{status:"ok"}` or 503 if DB unreachable; ready to wire into HEALTHCHECK

### Critical Pitfalls

1. **`BETTER_AUTH_SECRET` has an insecure hardcoded default** — `"paperclip-dev-secret"` is the fallback if the env var is missing. Compose already uses `${BETTER_AUTH_SECRET:?}` to fail-fast, but the deployment runbook must enforce secret generation (`openssl rand -hex 32`) before first `docker compose up`. The code-level fallback means no error is logged if the guard is bypassed.

2. **Server container has no HEALTHCHECK** — Docker considers a container without a `HEALTHCHECK` healthy the moment the process starts. The `/health` endpoint exists and works; it just needs wiring into the Dockerfile: `HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 CMD curl -sf http://localhost:3100/health || exit 1`.

3. **PostgreSQL port 5432 exposed on all interfaces** — `docker-compose.yml` publishes `0.0.0.0:5432:5432`. Remove the `ports:` stanza from the `db` service before any network-accessible deployment. Container-to-container communication does not need published ports.

4. **`docker compose down -v` permanently destroys all data** — Named volumes (`pgdata`, `paperclip-data`) are silently deleted by the `-v` flag. Document this explicitly in the deployment runbook; consider bind mounts to `/opt/paperclip/` for visibility.

5. **`PAPERCLIP_PUBLIC_URL` mismatch breaks authentication** — BetterAuth derives cookie domains and CORS origins from this value. If it does not exactly match the URL in the user's browser (including scheme, hostname, and port), login will silently fail or loop. Default is `http://localhost:3100`; must be updated for any non-localhost access.

---

## Implications for Roadmap

The research points to a two-phase roadmap: get a working deployment, then harden it. The dependency chain is strict (Postgres must be healthy before server starts; server must have correct env vars to boot), so Phase 1 cannot be split. Phase 2 is a set of independent improvements with no mandatory order among themselves.

### Phase 1: Baseline Production Deployment

**Rationale:** Everything in this phase is a hard prerequisite for the deployment to function at all or to be minimally safe for non-localhost access. All items are low-complexity and interdependent — they must all be complete before any testing is meaningful.

**Delivers:** A running, browser-accessible Paperclip dashboard with authentication, persistent data, and automatic recovery from crashes.

**Addresses (from FEATURES.md):** All table stakes features — PostgreSQL service, database health check, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PAPERCLIP_DEPLOYMENT_MODE`, `HOST`/`PORT`, `SERVE_UI`, named volumes, port mapping, `PAPERCLIP_PUBLIC_URL`, migration-on-boot.

**Avoids:**
- Pitfall 1: `BETTER_AUTH_SECRET` — generate and add to `.env` before first start
- Pitfall 2: No server HEALTHCHECK — add `HEALTHCHECK` instruction to Dockerfile
- Pitfall 5: DB port exposed — remove `ports:` from `db` service (or restrict to `127.0.0.1`)
- Pitfall 6: `PAPERCLIP_PUBLIC_URL` mismatch — set to exact browser URL
- Pitfall 10: No restart policy — add `restart: unless-stopped` to both services

**Specific deliverables:**
- `.env` file with `BETTER_AUTH_SECRET` and `PAPERCLIP_PUBLIC_URL`
- `HEALTHCHECK` instruction in `Dockerfile`
- `restart: unless-stopped` on `db` and `server` in compose
- `PAPERCLIP_MIGRATION_AUTO_APPLY=true` explicit in compose env
- `5432` port binding removed or restricted to `127.0.0.1` in compose
- Deployment runbook covering secret generation and `docker compose up` sequence

### Phase 2: Operational Hardening

**Rationale:** These improvements have no strict dependencies on each other and no blocking dependency on Phase 1 beyond a running deployment. They reduce operational friction and close remaining security gaps before agents are connected.

**Delivers:** A deployment hardened for a 5-20 agent team: stable under reboots, with correct volume permissions, agent API keys pre-loaded, and documented data lifecycle.

**Addresses (from FEATURES.md):** Differentiator features — `USER_UID`/`USER_GID`, Postgres credential rotation, `PAPERCLIP_AUTH_DISABLE_SIGN_UP` (via UI), resource limits, agent API key env vars, `.env`-based secret management.

**Avoids:**
- Pitfall 3: Named volume destroyed by `down -v` — add runbook warning; optionally switch to bind mounts
- Pitfall 4: Silent migration auto-apply on image update — document `pg_dump` before updates; pin image tags
- Pitfall 7: Slow startup from UID remapping chown — set `USER_UID`/`USER_GID` at build time
- Pitfall 11: Secrets and master key in same volume — note `PAPERCLIP_SECRETS_MASTER_KEY_FILE` location option
- Pitfall 12: Connection pool exhaustion — set explicit pool size and PostgreSQL `max_connections`

**Specific deliverables:**
- `USER_UID`/`USER_GID` wired into compose (build args or env)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` added to compose env
- Postgres credentials rotated from defaults (`paperclip/paperclip`)
- Volume lifecycle documented (bind mount vs named volume decision made)
- Image pinning strategy documented (no `latest` in production)
- `pg_dump` backup procedure in runbook

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because you cannot harden a deployment that does not run
- Within Phase 1, the HEALTHCHECK and `.env` changes are the highest-priority items because they affect security and reliability from the first boot
- Phase 2 items are truly independent — postgres credential rotation, UID mapping, and connection pool tuning can be done in any order
- SSL/TLS, monitoring, and reverse proxy are explicitly deferred per PROJECT.md and would constitute a Phase 3 only if scope changes

### Research Flags

Phases with standard, well-documented patterns (no deeper research needed):
- **Phase 1:** All patterns are verified against actual codebase code. `HEALTHCHECK` syntax, compose guard syntax, and restart policy are Docker Compose fundamentals with high confidence.
- **Phase 2:** UID remapping, volume bind mounts, and image pinning are standard operational patterns.

Phases that may benefit from a research pass if scope expands:
- **SSL/TLS + reverse proxy (future Phase 3):** If HTTPS is added, Traefik with Docker labels is the lowest-friction option for this stack, but the specific BetterAuth cookie/CORS interaction with a reverse proxy will need validation against the codebase.
- **Connection pool tuning (Phase 2 tail):** Optimal `max_connections` and Drizzle pool size for 5-20 concurrent agents is workload-dependent and cannot be determined without load testing.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings from direct Dockerfile and docker-compose.yml inspection; no inference required |
| Features | HIGH | Feature flags and env vars traced directly from `server/src/index.ts`, `server/src/config.ts`, and `packages/db/src/runtime-config.ts` |
| Architecture | HIGH | Two-service topology verified from compose files, Dockerfile build stages, and startup sequence in `index.ts` |
| Pitfalls | HIGH | Each pitfall traced to specific source lines with exact code quotes; no speculation |

**Overall confidence:** HIGH

### Gaps to Address

- **Node LTS tag currency:** `node:lts-trixie-slim` resolves to Node 22.x as of early 2025. Node 24 LTS may have been released by April 2026 and the tag may now resolve differently. Verify with `docker run --rm node:lts-trixie-slim node --version` before finalizing the Dockerfile. The existing Dockerfile is likely already tested; this is a version awareness note, not a blocking concern.
- **Server auto-migration verification:** ARCHITECTURE.md and FEATURES.md both confirm the server auto-migrates on startup via `ensureMigrations()`. STACK.md notes `server/src/index.ts` was not fully read in that research thread. Both other agents read it fully and confirm the behavior. No init container is needed. This gap is resolved.
- **Postgres credential rotation impact:** The database URL (`postgres://paperclip:paperclip@db:5432/paperclip`) is hardcoded in `docker-compose.yml`. Rotating credentials requires updating both `POSTGRES_USER`/`POSTGRES_PASSWORD` on the `db` service and `DATABASE_URL` on the `server` service atomically. Document this dependency in the runbook.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/home/rhx/agentic/paperclip/Dockerfile` — image build stages, installed tools, ENV defaults
- `/home/rhx/agentic/paperclip/docker/docker-compose.yml` — service definitions, health checks, volumes, env vars
- `/home/rhx/agentic/paperclip/docker/docker-compose.quickstart.yml` — embedded-postgres mode (eval only)
- `/home/rhx/agentic/paperclip/scripts/docker-entrypoint.sh` — UID/GID remapping, gosu pattern
- `/home/rhx/agentic/paperclip/server/src/index.ts` — startup sequence, `ensureMigrations()`, auto-apply TTY detection
- `/home/rhx/agentic/paperclip/server/src/config.ts` — env var resolution, deployment mode validation
- `/home/rhx/agentic/paperclip/server/src/auth/better-auth.ts` — `BETTER_AUTH_SECRET` fallback (line 70)
- `/home/rhx/agentic/paperclip/server/src/routes/health.ts` — `/health` endpoint behavior
- `/home/rhx/agentic/paperclip/packages/db/src/client.ts` — connection pool defaults
- `/home/rhx/agentic/paperclip/packages/db/src/migration-runtime.ts` — migration engine
- `/home/rhx/agentic/paperclip/packages/db/src/runtime-config.ts` — `DATABASE_URL` vs embedded postgres resolution
- `/home/rhx/agentic/paperclip/.planning/PROJECT.md` — scope boundaries (SSL deferred, monitoring deferred)

### Secondary (MEDIUM confidence — training knowledge)
- Docker Compose Spec v2 documentation — `depends_on: condition: service_healthy`, restart policies, `.env` loading
- PostgreSQL 17 release timeline — current stable as of September 2024
- BetterAuth documentation — cookie domain and trusted origins behavior

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
