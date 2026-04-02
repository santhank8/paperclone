---
phase: 01-compose-foundation
plan: "01"
subsystem: docker
tags: [docker, compose, dockerfile, security, healthcheck]
dependency_graph:
  requires: []
  provides: [hardened-compose, dockerfile-healthcheck]
  affects: [all-subsequent-phases]
tech_stack:
  added: []
  patterns: [":?-guard-pattern", "bind-mounts", "docker-healthcheck"]
key_files:
  created: []
  modified:
    - docker/docker-compose.yml
    - Dockerfile
decisions:
  - "Used unless-stopped restart policy (standard production choice over always)"
  - "HEALTHCHECK interval=10s, start-period=60s, retries=5 to accommodate DB migration startup time"
  - "bind mounts at /mnt/paperclip/pgdata and /mnt/paperclip/data per D-03/D-04"
metrics:
  duration: "43s"
  completed: "2026-04-02"
  tasks_completed: 2
  files_modified: 2
---

# Phase 01 Plan 01: Compose Foundation Summary

**One-liner:** Hardened docker-compose.yml with parameterized credentials, bind mounts, restart policies, and added HEALTHCHECK to Dockerfile production stage.

## What Was Changed

### docker/docker-compose.yml

1. **Restart policies (CONT-03):** Added `restart: unless-stopped` to both `db` and `server` services. Both services now automatically recover after crashes or host reboots.

2. **Parameterized PostgreSQL credentials (D-02, SEC-01):** Replaced hardcoded `paperclip/paperclip` credentials with `:?` guards — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Docker Compose will fail fast with a clear error message if any are missing. The `pg_isready` healthcheck command and `DATABASE_URL` updated to use these variables.

3. **Removed PostgreSQL host port exposure (SEC-02):** Deleted the `ports: - "5432:5432"` stanza from the `db` service. PostgreSQL is now reachable only within the Docker Compose network via the `db` hostname.

4. **Hardened PAPERCLIP_PUBLIC_URL (SEC-03):** Replaced `${PAPERCLIP_PUBLIC_URL:-http://localhost:3100}` (soft fallback) with `${PAPERCLIP_PUBLIC_URL:?PAPERCLIP_PUBLIC_URL must be set (e.g. http://192.168.1.100:3100)}` — forces explicit operator configuration.

5. **Switched to bind mounts (D-03, D-04):** Replaced named Docker volumes (`pgdata:`, `paperclip-data:`) with bind mounts at `/mnt/paperclip/pgdata` (PostgreSQL data) and `/mnt/paperclip/data` (Paperclip app data). Removed the top-level `volumes:` block. Prevents data loss from `docker compose down -v` and enables NFS snapshot backups.

6. **USER_UID/USER_GID build args (SEC-04):** Added `args: USER_UID: "${USER_UID:-1000}" USER_GID: "${USER_GID:-1000}"` to the server build section so host UID/GID is baked into the image at build time.

7. **PAPERCLIP_MIGRATION_AUTO_APPLY:** Added `PAPERCLIP_MIGRATION_AUTO_APPLY: "true"` to the server environment block to make migration behavior explicit per PITFALLS.md Pitfall 4.

### Dockerfile

Added `HEALTHCHECK` instruction to the `production` stage only, placed after `EXPOSE 3100` and before `ENTRYPOINT`:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -sf http://localhost:3100/health || exit 1
```

- `--interval=10s`: Polls every 10 seconds for quick outage detection
- `--timeout=5s`: HTTP request must complete within 5 seconds
- `--start-period=60s`: Grace period for server startup and DB migration (migrations can take 10-30s)
- `--retries=5`: Requires 5 consecutive failures (50s) before marking unhealthy — prevents flapping
- `curl -sf`: Silent mode, fail with non-zero exit on HTTP 4xx/5xx

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Harden docker-compose.yml | b8c5661b |
| 2 | Add HEALTHCHECK to Dockerfile | 8ac9165d |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `docker/docker-compose.yml` — exists and contains all required changes
- `Dockerfile` — exists with HEALTHCHECK in production stage only
- Commit b8c5661b — verified in git log
- Commit 8ac9165d — verified in git log
