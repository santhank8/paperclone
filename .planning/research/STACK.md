# Technology Stack

**Project:** Paperclip AI — Docker Compose Production Deployment
**Researched:** 2026-04-01
**Confidence:** HIGH (based on direct codebase analysis + verified knowledge of stable, widely-adopted tools)

---

## Executive Note

This is a brownfield deployment project. The application stack (Node.js, React, PostgreSQL, Drizzle ORM, pnpm) is already decided by the Paperclip codebase. This research focuses exclusively on the **deployment stack**: container images, Compose configuration, health checks, migration handling, secrets, and operational concerns. Do not introduce new application dependencies — work with what exists.

---

## Existing Infrastructure (From Codebase)

The repo ships a functional but incomplete Docker Compose setup. Understand what already works before deciding what to add:

| Component | Current State | Gap |
|-----------|--------------|-----|
| `docker/docker-compose.yml` | db + server services, pgdata + paperclip-data volumes | No health check on server, no restart policy |
| `Dockerfile` | Multi-stage build, node:lts-trixie-slim, multi-arch (amd64/arm64) | None — this is correct |
| `scripts/docker-entrypoint.sh` | gosu-based UID/GID remapping, drops privileges to `node` user | None |
| PostgreSQL health check | `pg_isready` with 2s interval, 30 retries | Correct, no change needed |
| Migration tooling | `pnpm --filter @paperclipai/db migrate` via `packages/db/src/migrate.ts` | Not wired into compose startup |
| Health endpoint | `GET /health` returns `{status:"ok"}` or 503 if DB unreachable | Not used in compose health check |
| GitHub CI | Pushes multi-arch image to `ghcr.io/[repo]:latest` on master | Available as pre-built image |

---

## Recommended Deployment Stack

### Container Images

| Technology | Tag | Purpose | Rationale | Confidence |
|------------|-----|---------|-----------|------------|
| `node:lts-trixie-slim` | Already in Dockerfile | Node.js runtime | Already used; LTS (Node 22.x) on Debian Trixie slim minimizes attack surface while retaining apt for gosu/gh/git tools the Dockerfile needs. Do not switch to Alpine — the build installs `github-cli` which requires Debian apt infrastructure. | HIGH |
| `postgres:17-alpine` | Already in compose | PostgreSQL database | Already used; PostgreSQL 17 is current stable (released Sept 2024). Alpine variant keeps image small (~80MB vs ~250MB for Debian). No `plpgsql` extensions or custom OS packages are needed by Paperclip. | HIGH |

**What NOT to use:**
- `postgres:latest` — tag is unstable and will break on major version bumps. Use `postgres:17-alpine` or pin to `postgres:17.x-alpine` for full reproducibility.
- `node:lts-alpine` — the Dockerfile uses `apt-get` to install `gh`, `git`, `ripgrep`, `gosu`, `python3`. These require Debian. Switching to Alpine would require rebuilding the Dockerfile.
- `node:current-*` — current release is Node 23.x (odd-numbered = not LTS). Node 22.x LTS is the production target per `package.json` `engines.node >= 20`.

### Docker Compose

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| Docker Compose v2 (`docker compose`) | Compose spec 3.8+ | Service orchestration | The existing compose files use Compose Spec syntax (no `version:` key needed in modern Docker Compose v2). All features used (named volumes, healthcheck, depends_on conditions) are stable in Compose v2. | HIGH |
| `.env` file | n/a | Secret injection | `BETTER_AUTH_SECRET` is required by compose (`?:` operator = fatal if unset). Compose automatically loads `.env` from the same directory as the compose file. | HIGH |

**Compose version note:** The existing `docker/docker-compose.yml` uses no `version:` key, which is correct for Compose Spec. Docker Desktop 4.x+ and Docker Engine 24+ support this natively. Do not add `version: "3.8"` — it is deprecated.

### Database Migration

| Approach | Command | When | Rationale | Confidence |
|----------|---------|------|-----------|------------|
| Init container pattern | `pnpm --filter @paperclipai/db migrate` | Before server starts | The server does NOT auto-run migrations on boot when `DATABASE_URL` is set (it auto-migrates only when using embedded-postgres mode). In Docker Compose with an external Postgres, migrations must be triggered explicitly. | HIGH |

The correct pattern is a dedicated `migrate` service in Compose that runs once and exits, with the `server` service depending on its successful completion:

```yaml
migrate:
  build:
    context: ..
    dockerfile: Dockerfile
  command: ["pnpm", "--filter", "@paperclipai/db", "migrate"]
  environment:
    DATABASE_URL: postgres://paperclip:paperclip@db:5432/paperclip
  depends_on:
    db:
      condition: service_healthy
  restart: "no"
```

Then `server` uses `depends_on: migrate: condition: service_completed_successfully`.

**Why not run migrations in the entrypoint?** The entrypoint (`docker-entrypoint.sh`) only does UID/GID remapping and drops to `node`. Adding migration there would couple migration failures to container startup in ways that make debugging harder. Init containers are the Compose standard pattern.

**Alternative considered: server auto-migration.** The `server/src/config.ts` shows the server checks `DATABASE_URL` environment variable. Reading `packages/db/src/migration-runtime.ts` confirms: when `DATABASE_URL` is set (postgres mode), migration is NOT automatic at server startup — only the embedded-postgres path auto-migrates. So the init container approach is required.

### Health Checks

| Service | Method | Endpoint/Command | Rationale | Confidence |
|---------|--------|-----------------|-----------|------------|
| `db` | `pg_isready` | Already configured: `pg_isready -U paperclip -d paperclip` | Standard PostgreSQL health check; already correct in the repo. | HIGH |
| `server` | HTTP GET | `GET http://localhost:3100/health` | The server exposes `/health` (see `server/src/app.ts:134`). It returns `{status:"ok"}` on success and HTTP 503 if the database is unreachable. Use `wget` or `curl` — the base image has both. | HIGH |

Recommended server health check config:
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3100/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 12
  start_period: 30s
```

`start_period: 30s` is important because the server starts Express, connects to Postgres, and runs any initialization before `/health` becomes ready. Without it, the health check will fail on first attempts and unnecessarily mark the container unhealthy.

### Secrets Management

| Technology | Approach | Rationale | Confidence |
|------------|---------|-----------|------------|
| `.env` file + environment variables | Required secrets: `BETTER_AUTH_SECRET` (32+ byte random string). Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`. | Compose's native env file support is sufficient for a single-host self-hosted deployment. Docker Swarm secrets or Vault are unnecessary overhead at this scale (5-20 agents). | HIGH |

**Required environment variables (compose must set or fail):**
- `BETTER_AUTH_SECRET` — authentication signing key. Generate with: `openssl rand -base64 32`
- `PAPERCLIP_PUBLIC_URL` — the URL users access the UI from (defaults to `http://localhost:3100` if unset, which is fine for local but breaks agent callbacks if behind a proxy)

**Optional but recommended:**
- `ANTHROPIC_API_KEY` — for Claude Code adapter
- `OPENAI_API_KEY` — for Codex adapter
- `USER_UID` / `USER_GID` — match host user UID/GID so the `paperclip-data` volume has correct ownership (entrypoint remaps at startup, but setting these avoids the chown pass)

### Volume Strategy

| Volume | Mount | Purpose | Rationale | Confidence |
|--------|-------|---------|-----------|------------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data files | Named volume managed by Docker. Do not bind-mount to host path unless you need easy access to pg data files. Named volumes are more portable. | HIGH |
| `paperclip-data` | `/paperclip` | App state: config files, secrets key, agent home dirs, storage | Named volume is the right default. If the host user needs to inspect files (e.g., to read agent outputs), a bind mount to a known path (e.g., `./data/paperclip`) is acceptable. | HIGH |

**Volume binding consideration:** The `docker-compose.quickstart.yml` uses a bind mount (`${PAPERCLIP_DATA_DIR:-../data/docker-paperclip}:/paperclip`). This is fine for development convenience but creates a host-path dependency. For production, named volumes are preferable because they survive directory moves.

### Restart Policy

All production services should have explicit restart policies:

```yaml
restart: unless-stopped
```

- `db`: `unless-stopped` — database should always restart unless explicitly stopped
- `server`: `unless-stopped` — same
- `migrate`: `"no"` — must only run once; restarting would re-run migrations unnecessarily (safe but wasteful, and would block server startup on each restart)

### Networking

Docker Compose creates a default network that connects all services by service name. No explicit network configuration is required. The service hostnames (`db`, `server`) resolve automatically within the network.

**What NOT to add:** A reverse proxy (Nginx, Traefik, Caddy) is explicitly out of scope per PROJECT.md ("SSL/TLS termination — not needed for initial deployment"). Port 3100 is exposed directly to the host. If this changes later, Traefik with Docker labels is the lowest-friction option for this stack.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Base image | `node:lts-trixie-slim` | `node:lts-alpine` | Dockerfile uses Debian apt packages (gh, gosu, ripgrep). Alpine would require significant Dockerfile rewrite. |
| DB image | `postgres:17-alpine` | `postgres:16-alpine` | 17 is current stable, already in repo. No reason to downgrade. |
| Migration | Init container | Server auto-migration at startup | Server does not auto-migrate when DATABASE_URL is external postgres. Wiring into entrypoint mixes concerns. |
| Migration | Init container | Separate migration CLI invocation pre-deploy | Init containers are reproducible and version-coupled to the same image. External CLI requires matching version management. |
| Secrets | `.env` file | Docker Secrets (Swarm) | Swarm required. Overkill for single-host self-hosted deployment. |
| Compose | Compose v2 spec | Helm/Kubernetes | Massive operational overhead. Docker Compose is the stated deployment target. |
| Reverse proxy | None (per scope) | Nginx/Traefik | Out of scope. Add later if HTTPS or hostname routing is needed. |

---

## Installation / Setup Commands

```bash
# Generate required secret
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> docker/.env
echo "PAPERCLIP_PUBLIC_URL=http://localhost:3100" >> docker/.env

# Build and start (from repo root)
cd docker
docker compose up --build -d

# View logs
docker compose logs -f server

# Check health
curl http://localhost:3100/health

# Run migrations manually if needed
docker compose run --rm migrate
```

---

## Key Gaps / Things Requiring Verification

- **Node LTS version:** The `node:lts-trixie-slim` tag resolves to Node 22.x as of early 2025. Verify this is still Node 22 (not 24) by checking `docker pull node:lts-trixie-slim && docker run --rm node:lts-trixie-slim node --version` before finalizing. Training knowledge cutoff is August 2025; Node 24 LTS may have been released by April 2026. **Confidence: MEDIUM** — the existing Dockerfile is likely tested and correct, but the LTS tag content may have shifted.
- **Migration auto-run behavior:** The `server/src/index.ts` was not fully read. It is possible the server calls migration on startup in some code path. Verify by checking `server/src/index.ts` or testing before adding an init container. If the server does auto-migrate, the init container is redundant but harmless.
- **`depends_on: service_completed_successfully`:** This requires Docker Compose v2.1+. Verify the target host Docker version supports this. All modern Docker Engine versions (24+) do.

---

## Sources

| Source | Type | Confidence |
|--------|------|------------|
| `/home/rhx/agentic/paperclip/Dockerfile` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/docker/docker-compose.yml` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/docker/docker-compose.quickstart.yml` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/scripts/docker-entrypoint.sh` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/server/src/config.ts` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/server/src/routes/health.ts` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/packages/db/src/client.ts` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/packages/db/src/migration-runtime.ts` | Direct codebase | HIGH |
| `/home/rhx/agentic/paperclip/package.json` | Direct codebase | HIGH |
| Docker Compose Spec documentation (training, v2 spec) | Training knowledge | MEDIUM |
| PostgreSQL 17 release timeline (training knowledge) | Training knowledge | MEDIUM |
