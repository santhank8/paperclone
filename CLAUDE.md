<!-- GSD:project-start source:PROJECT.md -->
## Project

**Paperclip AI — Production Deployment**

A Docker Compose-based production deployment of Paperclip, the open-source AI agent orchestration platform. The goal is to get Paperclip running in containers with its dashboard accessible, so a team of 5-20 AI agents (Claude Code, OpenClaw, Codex, Cursor) can connect and be managed from a single UI.

**Core Value:** The Paperclip dashboard is running and accessible, with agents able to connect and receive tasks.

### Constraints

- **Deployment**: Docker Compose — containerized services
- **Fresh install**: No migration path needed, clean database
- **Existing code**: Must work with the current Paperclip codebase as-is (brownfield)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Note
## Existing Infrastructure (From Codebase)
| Component | Current State | Gap |
|-----------|--------------|-----|
| `docker/docker-compose.yml` | db + server services, pgdata + paperclip-data volumes | No health check on server, no restart policy |
| `Dockerfile` | Multi-stage build, node:lts-trixie-slim, multi-arch (amd64/arm64) | None — this is correct |
| `scripts/docker-entrypoint.sh` | gosu-based UID/GID remapping, drops privileges to `node` user | None |
| PostgreSQL health check | `pg_isready` with 2s interval, 30 retries | Correct, no change needed |
| Migration tooling | `pnpm --filter @paperclipai/db migrate` via `packages/db/src/migrate.ts` | Not wired into compose startup |
| Health endpoint | `GET /health` returns `{status:"ok"}` or 503 if DB unreachable | Not used in compose health check |
| GitHub CI | Pushes multi-arch image to `ghcr.io/[repo]:latest` on master | Available as pre-built image |
## Recommended Deployment Stack
### Container Images
| Technology | Tag | Purpose | Rationale | Confidence |
|------------|-----|---------|-----------|------------|
| `node:lts-trixie-slim` | Already in Dockerfile | Node.js runtime | Already used; LTS (Node 22.x) on Debian Trixie slim minimizes attack surface while retaining apt for gosu/gh/git tools the Dockerfile needs. Do not switch to Alpine — the build installs `github-cli` which requires Debian apt infrastructure. | HIGH |
| `postgres:17-alpine` | Already in compose | PostgreSQL database | Already used; PostgreSQL 17 is current stable (released Sept 2024). Alpine variant keeps image small (~80MB vs ~250MB for Debian). No `plpgsql` extensions or custom OS packages are needed by Paperclip. | HIGH |
- `postgres:latest` — tag is unstable and will break on major version bumps. Use `postgres:17-alpine` or pin to `postgres:17.x-alpine` for full reproducibility.
- `node:lts-alpine` — the Dockerfile uses `apt-get` to install `gh`, `git`, `ripgrep`, `gosu`, `python3`. These require Debian. Switching to Alpine would require rebuilding the Dockerfile.
- `node:current-*` — current release is Node 23.x (odd-numbered = not LTS). Node 22.x LTS is the production target per `package.json` `engines.node >= 20`.
### Docker Compose
| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| Docker Compose v2 (`docker compose`) | Compose spec 3.8+ | Service orchestration | The existing compose files use Compose Spec syntax (no `version:` key needed in modern Docker Compose v2). All features used (named volumes, healthcheck, depends_on conditions) are stable in Compose v2. | HIGH |
| `.env` file | n/a | Secret injection | `BETTER_AUTH_SECRET` is required by compose (`?:` operator = fatal if unset). Compose automatically loads `.env` from the same directory as the compose file. | HIGH |
### Database Migration
| Approach | Command | When | Rationale | Confidence |
|----------|---------|------|-----------|------------|
| Init container pattern | `pnpm --filter @paperclipai/db migrate` | Before server starts | The server does NOT auto-run migrations on boot when `DATABASE_URL` is set (it auto-migrates only when using embedded-postgres mode). In Docker Compose with an external Postgres, migrations must be triggered explicitly. | HIGH |
### Health Checks
| Service | Method | Endpoint/Command | Rationale | Confidence |
|---------|--------|-----------------|-----------|------------|
| `db` | `pg_isready` | Already configured: `pg_isready -U paperclip -d paperclip` | Standard PostgreSQL health check; already correct in the repo. | HIGH |
| `server` | HTTP GET | `GET http://localhost:3100/health` | The server exposes `/health` (see `server/src/app.ts:134`). It returns `{status:"ok"}` on success and HTTP 503 if the database is unreachable. Use `wget` or `curl` — the base image has both. | HIGH |
### Secrets Management
| Technology | Approach | Rationale | Confidence |
|------------|---------|-----------|------------|
| `.env` file + environment variables | Required secrets: `BETTER_AUTH_SECRET` (32+ byte random string). Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`. | Compose's native env file support is sufficient for a single-host self-hosted deployment. Docker Swarm secrets or Vault are unnecessary overhead at this scale (5-20 agents). | HIGH |
- `BETTER_AUTH_SECRET` — authentication signing key. Generate with: `openssl rand -base64 32`
- `PAPERCLIP_PUBLIC_URL` — the URL users access the UI from (defaults to `http://localhost:3100` if unset, which is fine for local but breaks agent callbacks if behind a proxy)
- `ANTHROPIC_API_KEY` — for Claude Code adapter
- `OPENAI_API_KEY` — for Codex adapter
- `USER_UID` / `USER_GID` — match host user UID/GID so the `paperclip-data` volume has correct ownership (entrypoint remaps at startup, but setting these avoids the chown pass)
### Volume Strategy
| Volume | Mount | Purpose | Rationale | Confidence |
|--------|-------|---------|-----------|------------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data files | Named volume managed by Docker. Do not bind-mount to host path unless you need easy access to pg data files. Named volumes are more portable. | HIGH |
| `paperclip-data` | `/paperclip` | App state: config files, secrets key, agent home dirs, storage | Named volume is the right default. If the host user needs to inspect files (e.g., to read agent outputs), a bind mount to a known path (e.g., `./data/paperclip`) is acceptable. | HIGH |
### Restart Policy
- `db`: `unless-stopped` — database should always restart unless explicitly stopped
- `server`: `unless-stopped` — same
- `migrate`: `"no"` — must only run once; restarting would re-run migrations unnecessarily (safe but wasteful, and would block server startup on each restart)
### Networking
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
## Installation / Setup Commands
# Generate required secret
# Build and start (from repo root)
# View logs
# Check health
# Run migrations manually if needed
## Key Gaps / Things Requiring Verification
- **Node LTS version:** The `node:lts-trixie-slim` tag resolves to Node 22.x as of early 2025. Verify this is still Node 22 (not 24) by checking `docker pull node:lts-trixie-slim && docker run --rm node:lts-trixie-slim node --version` before finalizing. Training knowledge cutoff is August 2025; Node 24 LTS may have been released by April 2026. **Confidence: MEDIUM** — the existing Dockerfile is likely tested and correct, but the LTS tag content may have shifted.
- **Migration auto-run behavior:** The `server/src/index.ts` was not fully read. It is possible the server calls migration on startup in some code path. Verify by checking `server/src/index.ts` or testing before adding an init container. If the server does auto-migrate, the init container is redundant but harmless.
- **`depends_on: service_completed_successfully`:** This requires Docker Compose v2.1+. Verify the target host Docker version supports this. All modern Docker Engine versions (24+) do.
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
