# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Paperclip?

Open-source Node.js server + React UI that orchestrates teams of AI agents to run businesses. It's a control plane — not an agent framework. It provides org charts, budgets, governance, goal alignment, and agent coordination. Agents (Claude Code, Codex, Cursor, OpenClaw, etc.) plug in via adapters.

## Commands

```sh
# Development
pnpm install              # Install dependencies (pnpm 9+, Node 20+)
pnpm dev                  # Full dev server + UI (watch mode), API at localhost:3100
pnpm dev:once             # Same but no file watching
pnpm dev:server           # Server only
pnpm dev:ui               # UI only (Vite)
pnpm dev:list             # Show running dev process
pnpm dev:stop             # Stop running dev process

# Build & Verify
pnpm build                # Build all packages
pnpm -r typecheck         # Typecheck all packages
pnpm test:run             # Run all tests (vitest)
pnpm test -- --run --project @paperclipai/server  # Run tests for a specific workspace
pnpm test -- --run -t "test name pattern"          # Run specific test by name

# Database
pnpm db:generate          # Generate Drizzle migration after schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:backup            # Manual DB backup

# E2E & Smoke Tests
pnpm test:e2e             # Playwright e2e tests
pnpm smoke:openclaw-join  # OpenClaw join smoke test

# CLI
pnpm paperclipai <command> # Run CLI commands (onboard, run, doctor, configure, etc.)
```

## Verification Checklist (run before claiming done)

```sh
pnpm -r typecheck && pnpm test:run && pnpm build
```

## Key Reference Docs

Before making significant changes, consult in this order:
1. `doc/GOAL.md` — project goals
2. `doc/PRODUCT.md` — product context
3. `doc/SPEC-implementation.md` — V1 build contract (the concrete implementation target)
4. `doc/DEVELOPING.md` — full development guide
5. `doc/DATABASE.md` — database setup options

## Architecture

### Monorepo Structure (pnpm workspaces)

- **`server/`** — Express REST API, orchestration services, adapter registry, middleware
- **`ui/`** — React 19 + Vite 6 + Tailwind CSS 4 + React Router 7 + TanStack Query
- **`cli/`** — Commander.js CLI (onboard, run, doctor, configure, context, issue, agent, etc.)
- **`packages/db/`** — Drizzle ORM schema, numbered migrations, DB client, backup/restore
- **`packages/shared/`** — Shared types, Zod validators, constants, status enums, API path constants
- **`packages/adapter-utils/`** — Shared adapter types and utilities
- **`packages/adapters/`** — Agent adapter packages (claude-local, codex-local, cursor-local, gemini-local, opencode-local, pi-local, qwen-local, openclaw-gateway). The server adapter registry also includes hermes_local (npm plugin), process, and http adapters.
- **`packages/plugins/`** — Plugin SDK (`definePlugin()`, `runWorker()`), scaffolding tool, examples

### Server (`server/src/`)

- **Entry**: `index.ts` → `startServer()` initializes config, DB, auth, adapter registry, lifecycle services
- **Routes**: Domain-organized in `routes/` — factory functions accepting `db` and services (e.g., `agentRoutes(db)`)
- **Services**: Stateless factories in `services/` — accept `db`, return method objects (e.g., `agentService(db).create()`)
- **Adapters**: Registry pattern in `adapters/registry.ts` — built-in + external plugin adapters, with override/pause/restore
- **Middleware**: `actorMiddleware` (resolves board user or agent identity), board-mutation-guard, private-hostname-guard, validation
- **Auth model**: Board access = full-control operator. Agent access = bearer API keys (hashed at rest), scoped to their company only. Routes must enforce actor permissions and company boundaries.

### UI (`ui/src/`)

- Multi-company routing via URL prefixes (`/COMPANY/dashboard`)
- React Context for app state (Company, Dialog, Toast, Theme, Sidebar, LiveUpdates)
- Fetch-based API client in `api/client.ts` with per-domain modules

### Key Design Patterns

- **Everything is company-scoped** — all entities belong to a company, routes enforce company boundaries
- **Single-assignee task model** — atomic issue checkout prevents double-work
- **Adapter registry** — pluggable LLM providers; external adapters loaded dynamically from plugins
- **Heartbeat scheduling** — agents wake on schedule, check work, act; delegation flows through org chart
- **Activity logging** — all mutations produce audit log entries

## Database Change Workflow

1. Edit schema in `packages/db/src/schema/*.ts`
2. Export new tables from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate` (compiles `packages/db` first, then generates migration)
4. Run `pnpm -r typecheck` to validate

Note: `drizzle.config.ts` reads compiled schema from `dist/schema/*.js`, so the build step matters.

## Contract Synchronization

When changing schema or API behavior, update all impacted layers:
1. `packages/db` — schema and exports
2. `packages/shared` — types, constants, validators
3. `server` — routes and services
4. `ui` — API clients and pages

## Dev Environment

- Embedded PostgreSQL auto-starts when `DATABASE_URL` is unset — data at `~/.paperclip/instances/default/db`
- Reset dev DB: `rm -rf ~/.paperclip/instances/default/db && pnpm dev`
- Local storage at `~/.paperclip/instances/default/data/storage`
- Secrets: local encryption with master key at `~/.paperclip/instances/default/secrets/master.key`

## Lockfile Policy

Do not commit `pnpm-lock.yaml` in pull requests. CI regenerates it on merge to master.

## PR Requirements

PRs must follow `.github/PULL_REQUEST_TEMPLATE.md` with all sections: Thinking Path, What Changed, Verification, Risks, Model Used, and Checklist.
