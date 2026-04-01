# Feature Landscape

**Domain:** Production Docker Compose deployment — Node.js + PostgreSQL AI orchestration platform
**Project:** Paperclip AI
**Researched:** 2026-04-01

---

## Source Material

All findings derived from direct inspection of:
- `docker/docker-compose.yml` — base compose config (server + db services)
- `docker/docker-compose.quickstart.yml` — embedded-postgres quickstart
- `Dockerfile` — multi-stage build, entrypoint, env defaults
- `scripts/docker-entrypoint.sh` — UID/GID remapping via gosu
- `server/src/index.ts` — startup sequence, migration flow, auth init
- `server/src/config.ts` — full env var / config-file resolution
- `packages/db/src/runtime-config.ts` — database target resolution
- `packages/db/src/client.ts` — migration engine
- `server/src/routes/health.ts` — health endpoint behavior
- `docker/quadlet/` — systemd quadlet alternative deployment
- `docker/docker-compose.untrusted-review.yml` — security hardening reference

---

## Table Stakes

Features the deployment fails or is unusable without.

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| PostgreSQL service with named volume | Server exits if `DATABASE_URL` unreachable | Low | Already in `docker-compose.yml` as `postgres:17-alpine` with `pgdata` volume |
| Database health check before server start | Server startup block waits for postgres; `depends_on: condition: service_healthy` | Low | `pg_isready` check present in compose; retries=30, interval=2s |
| `DATABASE_URL` env var wired to server | `resolveDatabaseTarget()` reads `DATABASE_URL` first; without it falls back to embedded postgres (wrong for compose) | Low | Must point to `db` service hostname |
| `BETTER_AUTH_SECRET` env var | Server throws hard error at startup in `authenticated` mode if missing; compose uses `${BETTER_AUTH_SECRET:?}` syntax to fail-fast | Low | Must be ≥ 32-char random string; required secret |
| `PAPERCLIP_DEPLOYMENT_MODE=authenticated` | Without this, server runs in `local_trusted` mode which requires loopback binding — incompatible with `HOST=0.0.0.0` | Low | Both compose files already set this |
| `HOST=0.0.0.0` and `PORT=3100` | Server must bind all interfaces to be reachable from outside the container | Low | Already set in Dockerfile ENV defaults |
| `SERVE_UI=true` | Without this the React dashboard is not served; agents can connect but there is no UI | Low | Default is `true` in Dockerfile ENV |
| Named volume for `/paperclip` | All runtime data (config, secrets key file, backups, storage) written under `PAPERCLIP_HOME=/paperclip`; without persistence, every restart is a fresh install | Low | `paperclip-data` volume present in compose |
| Port mapping for server | Browser and agents must reach port 3100 from outside Docker network | Low | `3100:3100` in compose |
| `PAPERCLIP_PUBLIC_URL` set correctly | Used to derive `better-auth` trusted origins and CORS; wrong value blocks browser sign-in callbacks | Low | Defaulted to `http://localhost:3100`; must be updated for non-localhost access |
| Automatic migration on startup | `startServer()` calls `ensureMigrations()` before creating the Express app; if migrations fail the process exits | Low | Built into server startup; works automatically when `DATABASE_URL` is valid |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` | Required companion to `authenticated` mode; without it the server config validation path fails | Low | Already in both compose files |

---

## Differentiators

Features that make the deployment production-hardened. Not required to boot, but meaningful for reliability, security, and maintainability.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `USER_UID` / `USER_GID` build args | Entrypoint remaps the `node` user to match host UID/GID; prevents volume permission mismatches on Linux hosts | Low | `docker-entrypoint.sh` + `gosu` pattern already implemented; just needs correct values passed |
| `PAPERCLIP_MIGRATION_AUTO_APPLY=true` | Suppresses interactive migration prompts in non-TTY containers; prevents startup hang if migration prompt fires in a borderline case | Low | Env var respected by `promptApplyMigrations()` in `index.ts` |
| Postgres credentials rotated from defaults | `docker-compose.yml` ships `paperclip/paperclip` — change for any non-local deployment | Low | POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB + matching DATABASE_URL |
| Postgres port not exposed to host | Removing `5432:5432` port mapping shrinks attack surface; server reaches db via internal Docker network | Low | Currently exposed in base compose; should be removed or made optional |
| `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true` after bootstrap | Prevents open registration after first admin account is created | Low | Env var respected by config loader |
| `PAPERCLIP_ALLOWED_HOSTNAMES` configured | Locks hostname validation to known good values; guards against host-header injection | Low | Takes comma-separated list; derived automatically from `PAPERCLIP_PUBLIC_URL` hostname already |
| DB backup volume mounted | `databaseBackupEnabled` defaults to true; backups written to `$PAPERCLIP_HOME/instances/default/data/backups`; needs a persistent volume or bind mount to survive container replacement | Medium | `PAPERCLIP_DB_BACKUP_ENABLED`, `PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES`, `PAPERCLIP_DB_BACKUP_RETENTION_DAYS` all configurable |
| `BETTER_AUTH_TRUSTED_ORIGINS` explicitly set | Prevents CORS failures when accessing the dashboard from a non-localhost origin (Tailscale, internal DNS, reverse proxy) | Low | Comma-separated list; auto-derived from `PAPERCLIP_PUBLIC_URL` but explicit is safer |
| Resource limits on containers | Prevents a runaway agent from starving the postgres or server container | Low | `deploy.resources.limits` in Compose v3; not in current files |
| Restart policy `unless-stopped` or `on-failure` | Survives host reboots and transient crashes without manual intervention | Low | Not set in current compose; quadlet uses `Restart=on-failure` |
| Agent API key env vars pre-loaded | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` wired into container so agents inherit them without needing per-agent configuration in UI | Low | Present in quickstart compose; omitted from base compose |
| `.env` file for secret injection | Keeps secrets out of `docker-compose.yml` history; Docker Compose natively reads `.env` in the same directory | Low | Standard practice; compose `${VAR:?error}` syntax pairs well with this |
| Health check on server container | Enables `depends_on: condition: service_healthy` for downstream services; also surfaces state in `docker ps` | Low | `/health` endpoint exists and returns `503` when DB unreachable; no `healthcheck:` block in current server service definition |

---

## Anti-Features

Things to deliberately NOT build for the initial deployment milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SSL/TLS termination in Compose | Adds nginx/caddy service, cert management, and port logic; PROJECT.md explicitly defers this | Accept HTTP for localhost/private network access; add reverse proxy separately later if needed |
| Monitoring stack (Prometheus, Grafana) | Doubles compose complexity; no agent traffic to monitor yet; PROJECT.md defers until agents are running | Ship first, observe with `docker logs`; add monitoring as a later milestone |
| Kubernetes / Swarm migration | Premature for a team of 5-20 agents on a single host; overkill complexity | Quadlet files already exist for systemd if needed; Compose is the right level |
| Custom Postgres init scripts | Drizzle migrations handle all schema setup automatically at server startup; init scripts create ordering conflicts | Let `applyPendingMigrations()` in `index.ts` do all DDL |
| Separate migration init container | Server startup already handles migrations idempotently via `ensureMigrations()`; a separate init container adds a dependency edge for zero benefit in this setup | Set `PAPERCLIP_MIGRATION_AUTO_APPLY=true` and let the server self-migrate |
| Multi-instance / sharded deployment | Single instance is the design target; `PAPERCLIP_INSTANCE_ID=default` is all that's needed | Add instance ID config only if/when multi-tenancy is actually required |
| S3/remote storage provider | `storageProvider` defaults to `local_disk`; S3 requires additional env vars and IAM setup | Use local disk backed by the `/paperclip` volume; revisit if attachments outgrow single-host storage |
| Plugin extensions in Compose | PROJECT.md defers custom plugins; vanilla install first | Mount `/paperclip` volume cleanly; plugins can be configured through UI after deployment |
| Budget/cost tracking configuration | PROJECT.md explicitly defers this | Available via UI after agents connect |

---

## Feature Dependencies

```
PostgreSQL service running
  -> DB health check passes
    -> server container starts (depends_on: service_healthy)
      -> DATABASE_URL resolved in runtime-config.ts
        -> migrations applied automatically (ensureMigrations)
          -> better-auth initialized (BETTER_AUTH_SECRET required)
            -> server binds 0.0.0.0:3100 (HOST + PORT)
              -> UI served (SERVE_UI=true)
                -> browser-accessible dashboard at PAPERCLIP_PUBLIC_URL
                  -> agents can connect via HTTP API

PAPERCLIP_DEPLOYMENT_MODE=authenticated
  -> requires BETTER_AUTH_SECRET
  -> requires PAPERCLIP_PUBLIC_URL (for trusted origins)
  -> optional: PAPERCLIP_AUTH_DISABLE_SIGN_UP after first admin signup
  -> optional: BETTER_AUTH_TRUSTED_ORIGINS for non-localhost origins

Named volume /paperclip
  -> secrets key file persisted (local_encrypted provider)
  -> agent config persisted
  -> DB backups persisted (if enabled)
  -> no data loss on container restart
```

---

## MVP Recommendation

Prioritize these in order to achieve the PROJECT.md goal (dashboard accessible, agents connectable):

1. **PostgreSQL service + health check** — blocking dependency for everything else
2. **`DATABASE_URL` wired correctly** — server startup path requires it for external-postgres mode
3. **`BETTER_AUTH_SECRET` set** — hard startup error without it in `authenticated` mode
4. **`PAPERCLIP_PUBLIC_URL` set correctly** — browser-facing URL for auth callbacks; wrong value blocks first sign-in
5. **`USER_UID`/`USER_GID` matching host** — prevents volume ownership failures on Linux (trivial, high pain if wrong)
6. **`PAPERCLIP_MIGRATION_AUTO_APPLY=true`** — defensive; avoids any risk of startup hang in container
7. **Agent API keys wired (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)** — required for Claude Code, Codex agents to function

Defer:
- SSL/TLS — not needed for private LAN/localhost access
- Monitoring stack — defer until agents are running and producing data
- DB backup volume tuning — backups already enabled by default; just ensure the volume is mounted
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP` — configure through UI after first admin setup

---

## Sources

- Direct code inspection (HIGH confidence — source of truth):
  - `/home/rhx/agentic/paperclip/server/src/index.ts`
  - `/home/rhx/agentic/paperclip/server/src/config.ts`
  - `/home/rhx/agentic/paperclip/packages/db/src/runtime-config.ts`
  - `/home/rhx/agentic/paperclip/docker/docker-compose.yml`
  - `/home/rhx/agentic/paperclip/docker/docker-compose.quickstart.yml`
  - `/home/rhx/agentic/paperclip/scripts/docker-entrypoint.sh`
  - `/home/rhx/agentic/paperclip/server/src/routes/health.ts`
  - `/home/rhx/agentic/paperclip/.planning/PROJECT.md`
