# Architecture Patterns

**Domain:** Node.js monorepo — AI agent orchestration platform (Docker Compose deployment)
**Researched:** 2026-04-01
**Confidence:** HIGH — based on direct codebase inspection

---

## Recommended Architecture

The existing codebase already defines the correct two-service Docker Compose topology.
`docker/docker-compose.yml` is the canonical reference. The architecture described here
is what that file implements, with the reasoning behind each decision made explicit for
roadmap purposes.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Host Network / Browser                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  :3100 (HTTP + WS)
                ┌───────────▼──────────────┐
                │      server container     │
                │  Express (port 3100)      │
                │  - REST API               │
                │  - WebSocket (live events)│
                │  - Static UI (SERVE_UI)   │
                │  - Agent adapter runners  │
                │  - Migration-on-boot      │
                └───────────┬──────────────┘
                            │  postgres://db:5432
                ┌───────────▼──────────────┐
                │        db container       │
                │  postgres:17-alpine       │
                │  healthcheck: pg_isready  │
                └───────────┬──────────────┘
                            │
                ┌───────────▼──────────────┐
                │   pgdata volume           │
                │  (persistent named vol)   │
                └──────────────────────────┘

                ┌──────────────────────────┐
                │  paperclip-data volume    │
                │  /paperclip (config,      │
                │  secrets, agent homes)    │
                └──────────────────────────┘
```

---

## Service Boundaries

### Service: `db`

| Attribute | Value |
|-----------|-------|
| Image | `postgres:17-alpine` |
| Port | `5432` (internal only; exposed to host in `docker-compose.yml` for debugging) |
| Responsibility | Persistent relational state — issues, agents, runs, users, secrets |
| Managed by | Docker healthcheck: `pg_isready -U paperclip -d paperclip` |
| Startup order | Must be healthy before `server` starts (health-check dependency) |

The `db` service has no application logic. It is a pure data store. Schema management
(Drizzle ORM migrations) is performed by the `server` process on startup, not by a
separate migration container.

### Service: `server`

| Attribute | Value |
|-----------|-------|
| Image | Built from root `Dockerfile` (multi-stage: base → deps → build → production) |
| Port | `3100` (HTTP + WebSocket on same port) |
| Responsibility | Everything application-level |
| Startup dependency | `db` service healthy |

The server container is a monolith in the Docker sense: it runs one Node.js process
that handles the following concerns internally:

- **HTTP API** — Express v5 with route modules for agents, issues, projects, companies,
  approvals, secrets, costs, plugins, etc.
- **Static UI** — When `SERVE_UI=true` (the default), the server serves the pre-built
  React bundle from `server/ui-dist/`. No separate Nginx or CDN needed.
- **WebSocket** — Live event streaming (`/realtime/live-events-ws.ts`) multiplexed on
  the same port as HTTP.
- **Agent adapter runners** — `claude-local`, `codex-local`, `cursor-local`,
  `gemini-local`, `openclaw-gateway`, `opencode-local`, `pi-local` adapters all run
  as in-process modules. Agents are spawned as child processes from within the server
  container.
- **Migration management** — On startup, the server checks Drizzle migration state and
  applies pending migrations automatically when `PAPERCLIP_MIGRATION_AUTO_APPLY=true`
  (which is the correct default for Docker deployments).
- **Authentication** — BetterAuth (`better-auth` package) for user sessions, plus
  JWT-based agent authentication.

**There is no separate UI container.** The `@paperclipai/ui` package is compiled at
image build time (`pnpm --filter @paperclipai/ui build`) and its output is copied into
`server/ui-dist` via the `prepare:ui-dist` script.

### Service: Not Needed — Embedded Postgres Fallback

The server has an `embedded-postgres` fallback (activated when `DATABASE_URL` is not
set). In Docker Compose deployment, `DATABASE_URL` is always set, so embedded Postgres
is never activated. The `docker-compose.quickstart.yml` (single container, no `db`
service) uses the embedded mode — this is only for quick local evaluation, not
production.

---

## Network Topology

```
docker-compose default network: paperclip_default (bridge)

  db:3100          — NOT exposed
  db:5432          — exposed to host :5432 (debug access; remove in hardened deployments)
  server:3100      — exposed to host :3100

Server reaches db via: postgres://paperclip:paperclip@db:5432/paperclip
  (service name "db" resolves on the compose network)

External agents reach server via: http://<host-ip>:3100
  (set PAPERCLIP_PUBLIC_URL to this value)
```

DNS resolution within the compose network is automatic: `db` resolves to the db
container's IP. The `DATABASE_URL` variable in `docker-compose.yml` is already
hardcoded correctly as `postgres://paperclip:paperclip@db:5432/paperclip`.

---

## Data Flow

### Browser / User

```
Browser → GET/POST :3100 → Express REST API → Drizzle ORM → PostgreSQL
Browser → WS :3100       → live-events-ws    → PostgreSQL (reads)
```

### Agent Connection (Claude Code, Codex, Cursor)

Local adapters (`claude-local`, `codex-local`, `cursor-local`) run as child processes
**inside the `server` container**. The server spawns the agent CLI (e.g., `claude`,
`codex`, `opencode`) as a subprocess, communicates over stdio/pipes, and proxies
results back to the database and WebSocket clients.

The CLIs are installed globally during the Docker image build:
```
npm install --global @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai
```

Agent home directory (`/paperclip`) is a named volume, persisting auth tokens across
container restarts.

### Agent Connection (OpenClaw Gateway)

OpenClaw uses the `openclaw-gateway` adapter, which connects to an external OpenClaw
service over WebSocket from inside the server container. The server initiates the
outbound connection — OpenClaw does not call back in.

### Secrets

API keys (Anthropic, OpenAI) are passed to the server container via environment
variables. Agents inherit them via `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. Paperclip
can also store secrets in its encrypted secrets store (files in `/paperclip/`).

---

## Component Build Order (Docker Image)

The multi-stage Dockerfile enforces this exact order:

```
Stage 1: base
  - node:lts-trixie-slim
  - Install: ca-certificates, curl, git, ripgrep, python3, gh CLI
  - Enable corepack (pnpm)
  - UID/GID remapping

Stage 2: deps  (cache layer)
  - Copy all package.json manifests
  - pnpm install --frozen-lockfile

Stage 3: build
  - Copy full source
  - pnpm --filter @paperclipai/ui build       (React → ui/dist/)
  - pnpm --filter @paperclipai/plugin-sdk build
  - pnpm --filter @paperclipai/server build   (TypeScript → server/dist/)
  - Verify server/dist/index.js exists

Stage 4: production
  - Copy entire /app from build stage (includes node_modules)
  - npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai
  - Copy docker-entrypoint.sh
  - Set ENV: NODE_ENV=production, PORT=3100, SERVE_UI=true, etc.
```

Build dependency graph for the workspace packages:

```
@paperclipai/shared         (no workspace deps)
@paperclipai/adapter-utils  (no workspace deps)
@paperclipai/db             (no workspace deps)
  └── adapters (all)        (depend on adapter-utils)
  └── @paperclipai/plugin-sdk (no workspace deps)
      └── @paperclipai/server  (depends on all of the above)
          └── @paperclipai/ui  (depends on adapters + shared)
```

The Dockerfile builds `ui` before `server` because `server` bundles a copy of the
compiled UI assets via the `prepare:ui-dist` script during `prepack`/packaging — but
in Docker, the server directly references `ui/dist` at runtime when `SERVE_UI=true`,
not the packaged `ui-dist`. The build order is: ui → plugin-sdk → server.

---

## Startup Sequence

```
1. db container starts
   └── PostgreSQL initializes cluster (if first run)
   └── Healthcheck: pg_isready begins polling (2s interval, 30 retries)

2. server container starts (waits for db healthy)
   └── docker-entrypoint.sh: adjust node UID/GID, exec gosu node
   └── server/dist/index.js (via tsx loader)
   └── loadConfig() — reads env vars + /paperclip/instances/default/config.json
   └── DATABASE_URL detected → skip embedded postgres
   └── ensureMigrations() → applies Drizzle migrations if needed
   └── createDb() → connection pool established
   └── createApp() → Express app + middleware + routes
   └── setupLiveEventsWebSocketServer() → WS server attached to HTTP server
   └── heartbeatService + routineService start (background timers)
   └── server.listen(3100, "0.0.0.0") → ready
```

---

## Volume Strategy

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data files — must survive container restart |
| `paperclip-data` | `/paperclip` | Config, secrets, agent auth tokens, embedded DB fallback dir |

Both are Docker named volumes. On fresh install neither contains data. The `paperclip-data`
volume must persist agent CLI auth state (`.claude/`, `.codex/`, etc.) if agents
authenticate inside the container.

---

## Patterns to Follow

### Pattern 1: Server-Renders UI (SERVE_UI=true)

**What:** The Express server serves `ui/dist` as static files at `/`. There is no
separate Nginx, CDN, or UI container.

**When:** Always in Docker Compose deployment. Only disable `SERVE_UI` if deploying
the UI separately (e.g., to a CDN).

**Why:** Simplifies the compose file to two services. No CORS configuration needed
since API and UI share origin. Reduces operational surface area for a self-hosted
deployment.

### Pattern 2: Migration-on-Boot (not a migration container)

**What:** The server applies Drizzle ORM migrations on startup before serving requests.

**When:** Every startup. Idempotent — already-applied migrations are skipped.

**Why:** Avoids the need for an init container or separate migration job in Compose.
Drizzle's `inspectMigrations` + `applyPendingMigrations` handle this safely.

**Configuration required:** `PAPERCLIP_MIGRATION_AUTO_APPLY=true` (or unset — the
server prompts interactively when stdin is a TTY, but auto-applies when it is not,
which is the Docker container case).

### Pattern 3: Agent CLIs in Server Container

**What:** Claude Code, Codex, and OpenCode CLIs are installed globally in the server
container image. Adapters spawn them as child processes.

**When:** Applies to all local adapters (claude-local, codex-local, opencode-local,
gemini-local, cursor-local, pi-local).

**Why:** Avoids the complexity of sidecar containers or agent containers with their own
networking. The server manages agent lifecycle internally.

**Trade-off:** The server container becomes large (~1GB+ image) and runs multiple
concerns. This is acceptable for a self-hosted team deployment.

### Pattern 4: Entrypoint UID Remapping

**What:** `docker-entrypoint.sh` remaps the `node` user's UID/GID to match `USER_UID`
/ `USER_GID` environment variables before exec-ing the server process.

**When:** Automatically, on every container start.

**Why:** Ensures files written to the `/paperclip` named volume have the correct host
UID, avoiding permission mismatches when the volume is also accessed from the host.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate UI Container

**What:** Splitting the React UI into its own Nginx container with a reverse proxy in front.

**Why bad:** The codebase is designed for `SERVE_UI=true`. Adding a reverse proxy
introduces CORS configuration, cookie domain complexity with BetterAuth, and a third
service to manage — with no benefit for a private self-hosted deployment.

**Instead:** Keep `SERVE_UI=true`. Add an Nginx or Caddy reverse proxy only when SSL
termination is required (and that is explicitly out of scope for this milestone).

### Anti-Pattern 2: External Migration Job or Init Container

**What:** A separate `docker compose run` step or init container to run migrations
before starting the server.

**Why bad:** The server already handles migration-on-boot safely. An init container
creates sequencing complexity in Compose and requires sharing database credentials in a
second service definition.

**Instead:** Rely on the server's built-in migration logic. Set
`PAPERCLIP_MIGRATION_AUTO_APPLY=true` explicitly in the compose env to suppress any
interactive prompts.

### Anti-Pattern 3: Embedding the Database in the Server Container

**What:** Using the `embedded-postgres` mode (no `DATABASE_URL` set) in the production
Docker Compose deployment.

**Why bad:** Embedded Postgres data is inside the server container's filesystem. If
the server container is re-created (not just restarted), all data is lost unless a
volume is correctly attached. The two-service topology with `DATABASE_URL` is far
safer and the existing `docker-compose.yml` already implements it correctly.

**Instead:** Always set `DATABASE_URL` in docker-compose deployments. The
`docker-compose.quickstart.yml` (single container, embedded Postgres) is for
evaluation only.

### Anti-Pattern 4: Exposing Database Port in Production

**What:** The existing `docker-compose.yml` publishes `db:5432` to the host. This is
fine for development but exposes the database to the host network in production.

**Why bad:** Unnecessary attack surface. The server container reaches PostgreSQL via
the compose internal network — external port binding is only needed for direct
developer access.

**Instead:** Remove the `ports:` block from the `db` service for hardened deployments.
Keep it during initial setup for debugging convenience, then remove it.

---

## Scalability Considerations

| Concern | At 5-20 agents (current target) | At 100+ agents |
|---------|----------------------------------|----------------|
| DB connections | Single server process, Drizzle connection pool — fine | May need PgBouncer or read replicas |
| Agent processes | All run inside server container — fine for 5-20 | Memory pressure; consider agent worker sidecars |
| WebSocket connections | Single Node.js WS server — fine | May need sticky sessions behind LB |
| Image size | Large image (Claude Code + Codex + OpenCode globally installed) — acceptable | Separate slim images per adapter type |

For the stated target (5-20 agents), the two-service topology is fully adequate.

---

## Sources

- `Dockerfile` — direct codebase inspection (HIGH confidence)
- `docker/docker-compose.yml` — direct codebase inspection (HIGH confidence)
- `docker/docker-compose.quickstart.yml` — direct codebase inspection (HIGH confidence)
- `docker/quadlet/` — direct codebase inspection (HIGH confidence)
- `server/src/index.ts` — startup sequence, migration logic, embedded postgres detection (HIGH confidence)
- `server/src/app.ts` — Express application structure (HIGH confidence)
- `server/src/realtime/live-events-ws.ts` — WebSocket topology (HIGH confidence)
- `server/package.json` — dependency list, adapter dependencies (HIGH confidence)
- `pnpm-workspace.yaml` — monorepo package boundaries (HIGH confidence)
- `scripts/docker-entrypoint.sh` — UID remapping pattern (HIGH confidence)
