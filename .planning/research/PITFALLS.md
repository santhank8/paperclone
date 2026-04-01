# Domain Pitfalls

**Domain:** Docker Compose deployment of Node.js + PostgreSQL AI orchestration platform (Paperclip)
**Researched:** 2026-04-01
**Scope:** Brownfield deployment — existing Dockerfile, docker-compose.yml, and server code analyzed directly

---

## Critical Pitfalls

Mistakes that cause total failure, data loss, or security compromise.

---

### Pitfall 1: BETTER_AUTH_SECRET Has a Hardcoded Insecure Default

**What goes wrong:** `server/src/auth/better-auth.ts` line 70 reads:
```
const secret = process.env.BETTER_AUTH_SECRET ?? process.env.PAPERCLIP_AGENT_JWT_SECRET ?? "paperclip-dev-secret";
```
If `BETTER_AUTH_SECRET` is not set in the environment, the server silently falls back to `"paperclip-dev-secret"`. Sessions signed with this known value can be forged by anyone who has read the source code — which is public.

**Why it happens:** Convenience default for local development was not stripped from the production path.

**Consequences:** Complete authentication bypass. An attacker can craft valid session tokens without credentials. All agents and users connecting to the instance are at risk.

**Prevention:**
- `docker-compose.yml` already uses `BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET must be set}"` — the `:?` syntax causes Compose to exit with an error if the variable is unset or empty.
- Ensure a `.env` file (or shell environment) at deploy time always provides a strong random value: `openssl rand -hex 32`.
- Never commit the secret to version control. Add `.env` to `.gitignore`.

**Detection:** If the server starts without a `BETTER_AUTH_SECRET` log line complaining about a missing value, check whether the fallback is being used. Add `docker compose config` verification to the deployment runbook.

**Phase:** Must be addressed in Phase 1 (initial deploy). The compose file already has the guard; the deployment runbook must enforce secret generation before first `docker compose up`.

---

### Pitfall 2: No HEALTHCHECK in the Server Dockerfile

**What goes wrong:** The `Dockerfile` defines no `HEALTHCHECK` instruction for the server container. Docker Compose's `depends_on: condition: service_healthy` only works when the depended-on service has a health check. The `db` service has one; the `server` service does not.

**Why it happens:** The health check was added for PostgreSQL but not extended to the application layer. Docker considers a container without a `HEALTHCHECK` to be healthy the moment it starts — even if the Node process is still initializing, running migrations, or in an error state.

**Consequences:**
- Any service that depends on `server` (e.g., a future reverse proxy or init container) will proceed before the server is actually ready.
- `docker compose up --wait` will return immediately after process start, not after the HTTP server is listening.
- Crashes during startup (migration failure, bad config) are invisible to Docker orchestration.

**Prevention:** Add a `HEALTHCHECK` to `Dockerfile` targeting the existing `/health` endpoint:
```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -sf http://localhost:3100/health || exit 1
```
`curl` is already installed in the base image. `--start-period=60s` accounts for the build time and migration runtime on first boot.

**Detection:** Run `docker inspect <container_id> | grep -A5 Health` — if the output shows `"Status": "none"`, there is no health check.

**Phase:** Phase 1. Needs to be in place before the deployment can be called production-grade.

---

### Pitfall 3: PostgreSQL Data Volume Uses an Anonymous Docker Volume

**What goes wrong:** `docker-compose.yml` declares:
```yaml
volumes:
  pgdata:
  paperclip-data:
```
Both are named Docker volumes with no explicit driver or bind-mount path. This means data lives wherever Docker's volume driver puts it (`/var/lib/docker/volumes/` on Linux) under a name that is project-scoped.

**Why it happens:** Named volumes are convenient defaults but they are invisible to operators unfamiliar with Docker volume management.

**Consequences:**
- Running `docker compose down -v` (a common "clean slate" command) **permanently destroys all database data**. There is no warning.
- Moving the deployment to a different host requires `docker volume export/import` or a `pg_dump` — neither obvious.
- Backup tooling that operates on filesystem paths will miss the data unless it explicitly targets Docker volumes.

**Prevention:**
- Add explicit bind-mount paths for production deployments so data location is visible and transferable:
  ```yaml
  volumes:
    - /opt/paperclip/pgdata:/var/lib/postgresql/data
    - /opt/paperclip/app-data:/paperclip
  ```
- Alternatively, document that `docker compose down` must **never** be run with `-v` in production. Add a warning comment to `docker-compose.yml`.
- Run `pg_dump` backups before any Compose teardown.

**Detection:** `docker volume ls | grep pgdata` — if you see a volume name like `docker_pgdata` or `paperclip_pgdata`, it is a named volume, not a bind mount.

**Phase:** Phase 1 setup. Decide on bind vs named volume before first data is written. Changing after data exists requires a migration step.

---

### Pitfall 4: Migration Behavior is Non-Deterministic When stdin/stdout Are Not TTYs

**What goes wrong:** `server/src/index.ts` line 102:
```typescript
if (!stdin.isTTY || !stdout.isTTY) return true; // auto-apply
```
In a Docker container stdin/stdout are not TTYs by default, so migrations auto-apply silently on every startup. This is the correct behavior for a container deployment, but it means:
- An image update that ships new migrations will apply them automatically on `docker compose up`, with no operator confirmation.
- A migration that has a bug or is destructive will run without warning.

**Why it happens:** The auto-apply logic was designed to be non-interactive in containers, which is reasonable. The risk is insufficient awareness of when it fires.

**Consequences:** Unexpected schema changes on container restart after an image update. For a fresh install this is fine; for a running instance with data it requires careful version management.

**Prevention:**
- Set `PAPERCLIP_MIGRATION_AUTO_APPLY=true` explicitly in the compose file to make the behavior intentional and visible rather than implicit.
- Pin the Docker image tag (or image digest) in production. Do not use `latest` or rebuild on `docker compose up`. Pull and review changelogs before updating.
- Always `pg_dump` before `docker compose pull && docker compose up -d`.

**Detection:** Watch startup logs for lines containing `Applying N pending migrations`. If they appear unexpectedly after an image update, a schema change was deployed silently.

**Phase:** Phase 1 (document in operational runbook). Phase 2+ (if multiple agents are running simultaneously, a restarting server mid-task could cause issues during migration windows).

---

### Pitfall 5: Database Port 5432 Exposed on All Interfaces

**What goes wrong:** `docker-compose.yml` publishes:
```yaml
ports:
  - "5432:5432"
```
This binds PostgreSQL's port to `0.0.0.0:5432` on the host, making the database accessible from the network — not just from other containers.

**Why it happens:** Port publishing is useful during development for direct psql access. It is often left in for production by accident.

**Consequences:** The database is reachable by anything that can connect to the host on port 5432. PostgreSQL's only protection is the password `paperclip` (plaintext in the compose file). Any network-level scan will find it.

**Prevention:**
- Remove the `ports` stanza from the `db` service entirely. Container-to-container communication inside a Compose network does not require published ports.
- If external DB access is needed for ops, use `127.0.0.1:5432:5432` to restrict to loopback only.

**Detection:** `docker ps` will show `0.0.0.0:5432->5432/tcp`. Correct binding shows `127.0.0.1:5432->5432/tcp` or no port binding at all.

**Phase:** Phase 1. Remove before the deployment is accessible from outside localhost.

---

## Moderate Pitfalls

Mistakes that cause operational problems but are recoverable without data loss.

---

### Pitfall 6: PAPERCLIP_PUBLIC_URL Must Match the Actual Access URL

**What goes wrong:** Better Auth uses `PAPERCLIP_PUBLIC_URL` to generate cookie domains, redirect URLs, and CSRF origin checks. `server/src/auth/better-auth.ts` line 73 reads:
```typescript
const publicUrl = process.env.PAPERCLIP_PUBLIC_URL ?? baseUrl;
```
If the URL in the environment does not match what the browser sees (e.g., behind a reverse proxy, different port, or accessed via IP instead of hostname), auth cookies will not be set correctly and login will silently fail or redirect to an unreachable origin.

**Why it happens:** The default in the compose file is `http://localhost:3100`, which is correct for local browser access but wrong if the instance is accessed from another machine or through a proxy.

**Prevention:**
- Set `PAPERCLIP_PUBLIC_URL` to the exact URL users will type in their browser (including scheme, hostname, and port if non-standard).
- If the instance is behind a reverse proxy at `http://192.168.1.100/paperclip`, that is the value needed.
- Verify by checking the `Set-Cookie` header after login — the domain should match.

**Detection:** After login, the browser redirects to a URL but shows a blank page or infinite redirect loop. Check the `Location` header on auth callbacks.

**Phase:** Phase 1, during initial access configuration.

---

### Pitfall 7: Volume UID Remapping Runs chown -R on Every Startup When UID Drifts

**What goes wrong:** `scripts/docker-entrypoint.sh` checks if the running user's UID/GID matches the `node` user and, if not, runs `usermod`/`groupmod` followed by `chown -R node:node /paperclip`. If the `/paperclip` volume contains many files (agent workspaces, embedded postgres data, stored assets), this `chown -R` scan can take seconds to minutes on startup.

**Why it happens:** The UID remapping feature is designed to match container user to host user for bind mounts. It is a well-intentioned feature that has a startup cost proportional to volume size.

**Consequences:** Slow container starts. If the container is killed mid-chown and restarts, permission state is inconsistent until the next full chown completes.

**Prevention:**
- Set `USER_UID` and `USER_GID` build args at image build time to match the host user, so the entrypoint detects no mismatch and skips the chown entirely.
- Alternatively, use bind mounts with consistent ownership rather than named Docker volumes where UID drift is common.
- For named volume deployments, this is typically a one-time cost on first deploy; it only recurs if the UID/GID changes.

**Detection:** Slow startup (>10s) on `docker compose up -d`. Check entrypoint logs for `"Updating node UID to..."` messages.

**Phase:** Phase 1 (build configuration). Note in deployment docs.

---

### Pitfall 8: The quickstart Compose File Uses No External Database

**What goes wrong:** `docker/docker-compose.quickstart.yml` has no `db` service and no `DATABASE_URL`. The server falls back to embedded PostgreSQL inside the container via the `/paperclip` volume. This is appropriate for quickstart/demo use, but the embedded Postgres data lives entirely inside the `PAPERCLIP_DATA_DIR` bind mount and is not managed by any Compose-aware health check or backup.

**Why it happens:** The quickstart file is deliberately minimal. The pitfall is using it for anything beyond single-user local testing.

**Consequences:** If the quickstart compose is used for a team deployment (5-20 agents), the embedded PostgreSQL has no connection pooling configuration, no independent health monitoring, and all its data is inside a single bind-mount directory that is easy to accidentally blow away.

**Prevention:**
- Use `docker/docker-compose.yml` (with the external `db` service) for all non-trivial deployments.
- Never run the quickstart compose in an environment where the data matters.

**Detection:** `docker compose ps` shows only one service (`paperclip`) with no separate `db` container.

**Phase:** Phase 1 — choose the right compose file before writing any data.

---

### Pitfall 9: Build Context Copies the Entire Repo Including Node Modules

**What goes wrong:** The `Dockerfile` uses `context: ..` from the `docker/` directory, which means the entire repo root is the build context. If a `.dockerignore` file is missing or incomplete, `node_modules/` directories (potentially gigabytes), `.git/`, and local `.env` files are all sent to the Docker daemon on every build.

**Why it happens:** Common oversight when Dockerfile build contexts are at repo root.

**Consequences:** Build times of several minutes even for small code changes. Risk of secrets in local `.env` files being baked into image layers.

**Detection:** `docker build` output shows "Sending build context to Docker daemon X.XX GB". Correct builds should send under 50MB.

**Phase:** Phase 1. Verify `.dockerignore` is present and correct before running the first build.

---

## Minor Pitfalls

---

### Pitfall 10: No Restart Policy in docker-compose.yml

**What goes wrong:** The main `docker-compose.yml` has no `restart:` policy on either service. If the server crashes (migration error, uncaught exception, OOM), it stays down until manually restarted.

**Prevention:** Add `restart: unless-stopped` to both the `db` and `server` services for production deployments. The Quadlet systemd unit already uses `Restart=on-failure` as a model.

**Phase:** Phase 1, low-effort fix at compose setup time.

---

### Pitfall 11: Agent API Keys and Secrets Are Written to the /paperclip Volume

**What goes wrong:** The secrets provider defaults to `local_encrypted` (`server/src/config.ts` line 102), which stores encrypted secrets inside the `/paperclip` volume. If that volume is backed up via filesystem snapshot (e.g., `rsync`), the encrypted secrets and their master key file may both be captured in the same backup, negating the encryption.

**Prevention:** Either use an external secrets provider (Vault, AWS Secrets Manager) for production, or ensure the master key file is stored separately from the encrypted blobs. The `PAPERCLIP_SECRETS_MASTER_KEY_FILE` env var controls key file location — point it outside the volume.

**Phase:** Phase 2 (agent configuration), before connecting real API keys.

---

### Pitfall 12: No Connection Pool Limits on the Postgres Client

**What goes wrong:** `packages/db/src/client.ts` uses `postgres(url)` with no explicit pool size. The `postgres` library defaults to `max: 10` connections. With 5-20 agents running simultaneously, each potentially firing concurrent queries through task sessions, burst connection demand can exceed the pool and cause timeouts or "too many clients" errors from PostgreSQL.

**Prevention:** Set an explicit pool size appropriate for the agent concurrency level and configure PostgreSQL's `max_connections` accordingly. A safe starting point is `max: 20` for the application pool with PostgreSQL `max_connections=50`. This requires a custom PostgreSQL config or environment variable (`POSTGRES_MAX_CONNECTIONS`) in the `db` service.

**Phase:** Phase 1 tuning, or Phase 2 when agents are active.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Initial docker compose up | BETTER_AUTH_SECRET not set (Pitfall 1) | Generate secret with `openssl rand -hex 32`, add to `.env` |
| Initial docker compose up | No HEALTHCHECK on server (Pitfall 2) | Add HEALTHCHECK to Dockerfile before first deploy |
| Database provisioning | Named volume destroyed by `down -v` (Pitfall 3) | Document explicitly; use bind mounts or named volume only |
| First browser access | PAPERCLIP_PUBLIC_URL mismatch (Pitfall 6) | Set to exact browser-visible URL |
| Connecting agents | API key secrets in same volume as master key (Pitfall 11) | Separate master key storage location |
| Scaling to 5-20 agents | Connection pool exhaustion (Pitfall 12) | Tune postgres pool and max_connections |
| Image update / redeployment | Silent migration auto-apply (Pitfall 4) | Explicit flag + pg_dump before update |
| Network exposure | DB port 5432 open to network (Pitfall 5) | Remove or restrict ports binding |

---

## Sources

- Direct code analysis: `Dockerfile`, `docker/docker-compose.yml`, `docker/docker-compose.quickstart.yml`, `scripts/docker-entrypoint.sh`
- Direct code analysis: `server/src/auth/better-auth.ts`, `server/src/index.ts`, `server/src/config.ts`
- Direct code analysis: `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/migration-runtime.ts`, `packages/db/src/runtime-config.ts`
- Direct code analysis: `server/src/routes/health.ts`
- Confidence: HIGH for all pitfalls — based on direct code inspection of the actual deployment artifacts, not external documentation
