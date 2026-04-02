# Phase 1: Compose Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the existing Docker Compose stack (`docker/docker-compose.yml`) so it starts safely with one command, survives crashes, and has no insecure defaults. This phase produces a production-ready compose file and `.env.template` — no networking or agent configuration (those are Phases 2 and 3).

</domain>

<decisions>
## Implementation Decisions

### Compose File Strategy
- **D-01:** Edit `docker/docker-compose.yml` in-place. No overlay files or separate production compose. One file to maintain.

### Database Credentials
- **D-02:** Parameterize PostgreSQL credentials via `.env` variables. Remove hardcoded `paperclip/paperclip` from compose file. Use `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}` with `:?` guards.

### Volume Strategy
- **D-03:** Switch from named Docker volumes to bind mounts. Host path: `/mnt/paperclip/` on docker-001 (NFS-backed via Synology).
  - `/mnt/paperclip/pgdata` → PostgreSQL data (`/var/lib/postgresql/data`)
  - `/mnt/paperclip/data` → Paperclip app data (`/paperclip`)
- **D-04:** This prevents data loss from `docker compose down -v` and makes backups trivial via NFS snapshots.

### Host Integration
- **D-05:** UID/GID on docker-001 is unknown — must be checked during execution (`id` on docker-001). The `USER_UID`/`USER_GID` build args and entrypoint remapping handle this, but correct values must be determined first.
- **D-06:** Traefik networking topology is unknown — must inspect Traefik's compose/config on docker-001 to determine if it uses a shared Docker network or host ports. This informs whether Paperclip needs to join a network or just expose a port. (Primarily Phase 2, but compose file may need `networks:` block.)

### Agent Architecture
- **D-07:** Claude Code, Codex, and OpenCode are pre-installed in the Docker image (child process model). No external agent setup needed for Phase 1.
- **D-08:** OpenClaw is not set up yet — deferred to Phase 3 or later. Connects via WebSocket gateway, not baked into image.
- **D-09:** Cursor adapter exists in codebase (child process model, like Claude Code).

### Claude's Discretion
- Server HEALTHCHECK implementation details (interval, timeout, retries) — use sensible defaults based on the existing `/health` endpoint
- Restart policy specifics (`unless-stopped` vs `always`) — pick the standard production choice
- `.env.template` format and documentation style

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker Infrastructure
- `Dockerfile` — Multi-stage build: base → deps → build → production. Installs agent CLIs globally. Entrypoint uses gosu for UID/GID remapping.
- `docker/docker-compose.yml` — The file being edited. Current state: 2 services (db + server), named volumes, exposed DB port, hardcoded creds.
- `scripts/docker-entrypoint.sh` — Runtime UID/GID remapping via usermod/groupmod + gosu. Reads USER_UID/USER_GID env vars.

### Server Startup
- `server/src/index.ts` — Server startup sequence. Auto-applies migrations when stdin is not a TTY (Docker containers). Check for PAPERCLIP_MIGRATION_AUTO_APPLY behavior.
- `server/src/routes/health.ts` — Health endpoint at `/health`. Returns 200 with `{status:"ok"}` or 503 when DB unreachable.

### Research Findings
- `.planning/research/PITFALLS.md` — 12 specific deployment pitfalls with prevention strategies
- `.planning/research/ARCHITECTURE.md` — Service boundaries, network topology, data flow
- `.planning/research/STACK.md` — Stack recommendations and gap analysis

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker/docker-compose.yml` — 80% correct, needs 5 targeted edits (HEALTHCHECK, restart, port restriction, cred parameterization, volume switch)
- `scripts/docker-entrypoint.sh` — UID/GID remapping fully implemented, just needs correct values passed
- `/health` endpoint — Already exists in server, just needs wiring as Docker HEALTHCHECK

### Established Patterns
- `${VAR:?message}` pattern already used for BETTER_AUTH_SECRET — extend to other required vars
- `depends_on: condition: service_healthy` already used for db → server dependency
- Multi-stage Dockerfile build is established and working

### Integration Points
- Server listens on port 3100 (hardcoded in Dockerfile ENV)
- Database connection via `DATABASE_URL` env var
- Paperclip data directory at `/paperclip` inside container

</code_context>

<specifics>
## Specific Ideas

- NFS-backed storage via Synology — bind mounts at `/mnt/paperclip/` on docker-001
- Proxmox VM hosting docker-001 — NFS mountpoint needs to be created and bound to the VM before Docker can use bind mounts
- Traefik integration details (shared network vs host ports) to be discovered during execution by inspecting existing Traefik config on docker-001

</specifics>

<deferred>
## Deferred Ideas

- OpenClaw gateway setup — not running yet, Phase 3+ scope
- Traefik file provider config — Phase 2 scope
- Cloudflare DNS challenge — Phase 2 scope
- Technitium DNS record — Phase 2 scope
- Agent API key configuration — Phase 3 scope

</deferred>

---

*Phase: 01-compose-foundation*
*Context gathered: 2026-04-01*
