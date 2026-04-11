# CLAUDE.md

## Project: Kaizai Workforce

This repository is a fork of [Paperclip](https://github.com/paperclipai/paperclip) — an open-source control plane for AI agent companies. We extend it with a LangGraph-based orchestrator that builds the Kaizai Trading Agent platform.

## Repository Layout

- `ui/`, `server/`, `packages/`, `cli/`, `skills/` — Paperclip upstream code. Do NOT modify unless necessary for Kaizai-specific features.
- `orchestrator/` — Our LangGraph execution engine (Python). This is where agent logic lives.
- `orchestrator/agents/` — SOUL.md and HEARTBEAT.md identity files for each agent.
- `orchestrator/config/kaizai.yaml` — Project configuration (risk tiers, budgets, heartbeat).
- `runner/` — Claude Code Runner Docker image.
- `deploy/vps/` — VPS deployment (Docker Compose + env template).
- `docs/` — Workforce specifications and decision logs.

## Shared VPS Infrastructure

This workforce runs on the SAME VPS (app-01) as the Kaizai Trading Agent platform. Both stacks coexist as separate Docker Compose projects on the same server.

### Infrastructure topology

```
app-01 (217.216.109.16)
├── Trading Platform Stack (docker-compose.app.yml in trading-agent repo)
│   ├── caddy (ports 80, 443) — reverse proxy for ALL subdomains
│   ├── market-data-api, order-router, pnl-service, ...
│   ├── redis, nats
│   └── Caddyfile includes: api.kaizai.co, mcp.kaizai.co, build.kaizai.co
│
├── Workforce Stack (docker-compose.yml in THIS repo, deploy/vps/)
│   ├── workforce-control (port 127.0.0.1:3100) — Paperclip dashboard
│   └── langgraph-orchestrator — LangGraph execution engine
│
db-01 (private VLAN 10.0.0.2)
├── trading_data     (trading_user)      — trading platform
├── langgraph_state  (langgraph_user)    — LangGraph checkpoints
└── workforce        (workforce_user)    — Paperclip control plane
```

### Critical rules for shared infrastructure

- **Caddy is NOT in our Docker Compose.** It runs in the trading platform stack. To add a route for `build.kaizai.co`, edit the Caddyfile in `stepan-korec/trading-agent/deploy/vps/caddy/Caddyfile`.
- **PostgreSQL is NOT a Docker service.** It runs on db-01 (separate server on private VLAN). Access via `extra_hosts` in docker-compose.yml, never via Docker service name.
- **Database ringfencing is mandatory.** Each database has its own user. `workforce_user` can ONLY connect to the `workforce` database. Cross-database access is denied.
- **Port 3100 is bound to localhost only** (`127.0.0.1:3100`). Caddy handles external TLS and proxying to this port.
- **Do NOT expose ports directly to the internet.** All external access goes through Caddy.
- **The workforce and trading platform share no Docker network.** They communicate only through the host (localhost ports) and the private VLAN (db-01).
- **Redis and NATS belong to the trading platform.** The workforce does NOT use them. The workforce uses PostgreSQL (for LangGraph state) and the Paperclip embedded store.

## Build & Test Commands

### Paperclip (Node.js)
```bash
pnpm install
pnpm dev          # Full dev (API + UI)
pnpm build        # Build all
pnpm typecheck    # Type checking
pnpm test:run     # Run tests
```

### Orchestrator (Python)
```bash
cd orchestrator
pip install -r requirements.txt
pip install -r requirements-test.txt
pytest tests/                    # All tests
pytest tests/unit/               # Unit tests only
```

### VPS Deployment
```bash
cd deploy/vps
cp .env.template .env            # Fill in values
docker compose up -d             # Start workforce-control + orchestrator
docker compose logs -f           # Watch logs
docker compose down              # Stop
```

## Target Project

The workforce builds `stepan-korec/trading-agent`. It interacts with that repo exclusively via:
- GitHub App API (issues, PRs, merges, reviews)
- Claude Code Runner (clones repo, writes code, pushes branches)
- GitHub Actions (triggers test/deploy workflows)

There is zero code coupling between the repos.

## Git Workflow

**All branches and PRs MUST go to `stepan-korec/workforce`, NEVER to `paperclipai/paperclip`.**

This repo is a fork of `paperclipai/paperclip`, which means `git push` can accidentally target the upstream repo if the `origin` remote is misconfigured or if a branch tracks `upstream/*`. Before pushing, always verify:

```bash
git remote -v
# origin    should point to stepan-korec/workforce (push target)
# upstream  should point to paperclipai/paperclip  (fetch only, never push)

git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
# Must resolve to origin/<branch>, not upstream/<branch>
```

Rules:
- `origin` = `stepan-korec/workforce` — this is the ONLY push target.
- `upstream` = `paperclipai/paperclip` — fetch-only, used for syncing upstream changes.
- Never run `git push upstream ...`. If you see a branch or PR open in `paperclipai/paperclip`, it is in the wrong repo and must be closed/moved.
- Feature branches (`claude/*`, `feat/*`, etc.) always push to `origin`.

## Upstream Sync

To pull upstream updates from `paperclipai/paperclip`:
```bash
git fetch upstream
git merge upstream/master
```

Our code lives in directories that don't exist upstream (`orchestrator/`, `runner/`, `deploy/`, `docs/`), so merges should be clean. Only modify Paperclip source files (`ui/`, `server/`, `packages/`) when necessary for Kaizai-specific features like the GitHub Connection entity.
