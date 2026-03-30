# Paperclip AI — Technical Deep Dive & Modification Guide

**Prepared for The Darwin Agency**
**Date: 2026-03-30**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Server (API & Orchestration)](#5-server-api--orchestration)
6. [Database Layer](#6-database-layer)
7. [UI (Board Dashboard)](#7-ui-board-dashboard)
8. [CLI](#8-cli)
9. [Agent Adapter System](#9-agent-adapter-system)
10. [Plugin System](#10-plugin-system)
11. [Skills System](#11-skills-system)
12. [Heartbeat Execution Model](#12-heartbeat-execution-model)
13. [Governance & Approvals](#13-governance--approvals)
14. [Budget & Cost Tracking](#14-budget--cost-tracking)
15. [Deployment Modes](#15-deployment-modes)
16. [Development Workflow](#16-development-workflow)
17. [Testing Infrastructure](#17-testing-infrastructure)
18. [Key Invariants & Design Decisions](#18-key-invariants--design-decisions)
19. [Modification Guide: How to Make It Ours](#19-modification-guide-how-to-make-it-ours)
20. [Risk Areas & Gotchas](#20-risk-areas--gotchas)

---

## 1. Executive Summary

Paperclip is an **open-source Node.js/React control plane** for orchestrating teams of AI agents to run a business autonomously. Think of it as a task management system with org charts, budgets, governance gates, and agent coordination baked in.

**Core value proposition:** If OpenClaw is an *employee*, Paperclip is the *company*. It doesn't run the agents — it tells them what to do, tracks their work, enforces budgets, and provides a human dashboard for oversight.

**Maturity:** Pre-1.0 (v0.3.x), but production-stable with a solid core — 238+ server TypeScript files, 66 services, full E2E test coverage, Docker support, and comprehensive documentation.

**License:** MIT

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Board (Human UI)                │
│            React 19 + Vite + Tailwind            │
│              Radix UI components                 │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / WebSocket
┌──────────────────▼──────────────────────────────┐
│               Paperclip Server                   │
│            Express 5 + TypeScript                │
│  ┌──────────┬──────────┬──────────┬───────────┐ │
│  │  Routes  │ Services │ Adapters │  Plugins  │ │
│  │  (25+)   │  (66+)   │  (7)     │  (SDK)    │ │
│  └──────────┴──────────┴──────────┴───────────┘ │
│  ┌──────────────────────────────────────────────┐│
│  │  Background Services                         ││
│  │  - Heartbeat Orchestrator                    ││
│  │  - Routine Scheduler                         ││
│  │  - Plugin Scheduler                          ││
│  │  - Cost Aggregator                           ││
│  │  - Live Event (WebSocket) Broadcaster        ││
│  └──────────────────────────────────────────────┘│
└──────────────────┬──────────────────────────────┘
                   │ Drizzle ORM
┌──────────────────▼──────────────────────────────┐
│              PostgreSQL 17                        │
│   (or embedded PGlite for local dev)             │
│         60+ tables, company-scoped               │
└─────────────────────────────────────────────────┘

      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ Claude   │  │ Codex    │  │ OpenClaw │  ... (7 adapters)
      │ Code     │  │ CLI      │  │ Gateway  │
      └──────────┘  └──────────┘  └──────────┘
          ▲              ▲             ▲
          │              │             │
     Heartbeat      Heartbeat     Heartbeat
     (env vars)     (env vars)    (WebSocket)
```

**Key architectural decisions:**
- **Stateless API** — all state lives in PostgreSQL; the server can restart without losing anything
- **Company-scoped multi-tenancy** — every entity belongs to a company; data isolation is enforced everywhere
- **Adapter pattern** — agents are runtime-agnostic; the adapter bridges Paperclip to Claude Code, Codex, Cursor, etc.
- **Heartbeat model** — agents don't run continuously; they wake, do work, and exit
- **Plugin system** — isolated worker processes for extensibility

---

## 3. Tech Stack

### Backend
| Component | Technology | Version/Notes |
|-----------|-----------|---------------|
| Runtime | Node.js | >= 20 |
| Language | TypeScript | Strict mode |
| HTTP Framework | Express | v5.1 |
| ORM | Drizzle ORM | v0.38+ |
| Database | PostgreSQL | 17 (embedded PGlite for dev) |
| Auth | better-auth | v1.4.18 |
| Validation | Zod | v3.24 |
| Logging | Pino | v9.6 |
| WebSocket | ws | v8.19 |
| File Storage | Local disk or S3 | @aws-sdk/client-s3 |
| Image Processing | Sharp | v0.34 |

### Frontend
| Component | Technology | Version/Notes |
|-----------|-----------|---------------|
| Framework | React | v19 |
| Build Tool | Vite | Fast HMR |
| Styling | Tailwind CSS | + typography plugin |
| UI Components | Radix UI | Accessible primitives |
| State/Data | TanStack React Query | v5.90 |
| Routing | React Router | v7.1 |
| Rich Text | MDX Editor + Lexical | Markdown editing |
| Charts/Diagrams | Mermaid | v11.12 |
| Icons | Lucide React | v0.574 |
| DnD | @dnd-kit | Drag and drop |

### CLI
| Component | Technology |
|-----------|-----------|
| Framework | Commander.js |
| Bundler | esbuild |
| Packaging | npm (paperclipai) |

### DevOps
| Component | Technology |
|-----------|-----------|
| Package Manager | pnpm (workspaces) |
| Testing | Vitest + Playwright |
| Containerization | Docker (multi-stage) |
| Orchestration | Docker Compose |
| CI Evals | PromptFoo |

---

## 4. Monorepo Structure

```
paperclip/
├── server/              # Express API + orchestration (main runtime)
├── ui/                  # React board dashboard
├── cli/                 # CLI tool (paperclipai)
├── packages/
│   ├── db/              # Drizzle schema, migrations, DB client
│   ├── shared/          # Types, constants, validators, API paths
│   ├── adapter-utils/   # Shared adapter helpers
│   ├── adapters/        # 7 agent runtime adapters
│   │   ├── claude-local/
│   │   ├── codex-local/
│   │   ├── cursor-local/
│   │   ├── gemini-local/
│   │   ├── openclaw-gateway/
│   │   ├── opencode-local/
│   │   └── pi-local/
│   └── plugins/         # Plugin SDK + runtime
├── skills/              # Agent skill definitions (injected at runtime)
├── doc/                 # Architecture docs, specs, plans
├── evals/               # PromptFoo eval configs
├── tests/               # E2E tests (Playwright)
├── scripts/             # Build/release helpers
├── releases/            # Release artifacts
└── docker/              # Docker support files
```

**Workspace config** (`pnpm-workspace.yaml`):
- `packages/*`, `packages/adapters/*`, `packages/plugins/*`
- `server`, `ui`, `cli`
- `evals/*`, `tests/*`

---

## 5. Server (API & Orchestration)

### Route Groups (25+)
Located in `server/src/routes/`:
- `agents.ts` — CRUD, inbox, heartbeat triggers
- `issues.ts` — Task CRUD, checkout, release, comments, documents, attachments
- `issues-checkout-wakeup.ts` — Atomic checkout with wakeup semantics
- `companies.ts` — Company management, portability (import/export)
- `projects.ts` — Project CRUD with workspaces
- `goals.ts` — Goal hierarchy management
- `approvals.ts` — Governance approval workflows
- `costs.ts` — Cost event tracking and aggregation
- `dashboard.ts` — Aggregated dashboard data
- `plugins.ts` — Plugin lifecycle management
- `routines.ts` — Scheduled recurring tasks
- `secrets.ts` — Encrypted secret management
- `health.ts` — Health check endpoints
- `llms.ts` — LLM integration endpoints
- Plus: access control, activity log, assets, execution workspaces, org chart SVG, sidebar badges

### Service Layer (66+ services)
Located in `server/src/services/`:
- **Core:** `issues.ts`, `agents.ts`, `companies.ts`, `goals.ts`, `projects.ts`
- **Orchestration:** `heartbeat.ts`, `heartbeat-run-summary.ts`, `issue-assignment-wakeup.ts`
- **Governance:** `approvals.ts`, `issue-approvals.ts`, `hire-hook.ts`
- **Budget:** `budgets.ts`, `costs.ts`, `finance.ts`
- **Plugin System:** `plugin-host-services.ts`, `plugin-event-bus.ts`, `plugin-dev-watcher.ts`, `plugin-capability-validator.ts`, `plugin-config-validator.ts`
- **Infrastructure:** `live-events.ts` (WebSocket), `activity-log.ts`, `assets.ts`, `documents.ts`, `execution-workspaces.ts`
- **Agent Management:** `agent-instructions.ts`, `agent-permissions.ts`, `default-agent-instructions.ts`, `company-skills.ts`
- **Workspace:** `workspace-supervisor.ts`, `workspace-supervisor-git.ts`

### Middleware
- Authentication (better-auth)
- Board mutation guard
- Private hostname guard
- Request logging (Pino HTTP)
- CORS handling

### Background Services
Started alongside the Express server:
1. **Heartbeat Orchestrator** — polls for agent wakeup requests, dispatches heartbeat runs
2. **Routine Scheduler** — executes recurring scheduled tasks
3. **Plugin Scheduler** — manages plugin job execution
4. **Cost Aggregator** — periodically rolls up cost events
5. **WebSocket Broadcaster** — pushes real-time events to connected board clients

---

## 6. Database Layer

### Overview
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema:** 60+ tables defined in `packages/db/src/schema/`
- **Migrations:** Drizzle Kit generates SQL migrations
- **Dev mode:** Embedded PGlite (no external DB needed)
- **Production:** PostgreSQL 17 (Docker or Supabase)

### Key Schema Files (30+)

| Domain | Tables |
|--------|--------|
| **Companies** | `companies`, `company_memberships`, `company_logos`, `company_secrets`, `company_secret_versions`, `company_skills` |
| **Agents** | `agents`, `agent_api_keys`, `agent_config_revisions`, `agent_runtime_state`, `agent_task_sessions`, `agent_wakeup_requests` |
| **Issues (Tasks)** | `issues`, `issue_comments`, `issue_documents`, `document_revisions`, `issue_labels`, `labels`, `issue_attachments`, `issue_read_states`, `issue_work_products`, `issue_inbox_archives`, `issue_approvals` |
| **Governance** | `approvals`, `approval_comments`, `join_requests`, `invites` |
| **Hierarchy** | `goals`, `projects`, `project_goals`, `project_workspaces` |
| **Execution** | `heartbeat_runs`, `heartbeat_run_events`, `execution_workspaces`, `workspace_operations`, `workspace_runtime_services` |
| **Budget/Cost** | `cost_events`, `budget_policies`, `budget_incidents`, `finance_events` |
| **Auth** | `auth` (better-auth tables), `board_api_keys`, `cli_auth_challenges` |
| **Plugins** | `plugins`, `plugin_config`, `plugin_company_settings`, `plugin_entities`, `plugin_jobs`, `plugin_logs`, `plugin_state`, `plugin_webhooks` |
| **Other** | `activity_log`, `assets`, `instance_settings`, `instance_user_roles`, `routines`, `principal_permission_grants` |

### Key Relationships
```
Company
  ├── Agents (belong to company)
  ├── Projects
  │     └── Project Workspaces
  ├── Goals
  │     └── Project Goals (link projects ↔ goals)
  ├── Issues (tasks)
  │     ├── Issue Comments
  │     ├── Issue Documents
  │     ├── Issue Labels
  │     ├── Issue Attachments
  │     └── Sub-issues (parentId → Issue)
  ├── Approvals
  ├── Cost Events
  └── Plugins
```

### Database Change Workflow
1. Edit schema in `packages/db/src/schema/*.ts`
2. Export new tables from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate` to create migration
4. Run `pnpm build` to validate compilation

---

## 7. UI (Board Dashboard)

### Pages (30+)
Located in `ui/src/pages/`:

| Page | Purpose |
|------|---------|
| `Dashboard.tsx` | Company overview, metrics, recent activity |
| `Agents.tsx` / `AgentDetail.tsx` | Agent management, config, status |
| `Issues.tsx` / `IssueDetail.tsx` | Task board, detail view with comments/documents |
| `MyIssues.tsx` / `Inbox.tsx` | Personal task views |
| `Goals.tsx` / `GoalDetail.tsx` | Goal hierarchy management |
| `Projects.tsx` / `ProjectDetail.tsx` | Project management with workspaces |
| `Approvals.tsx` / `ApprovalDetail.tsx` | Governance approval workflows |
| `Costs.tsx` | Cost tracking and budget views |
| `Activity.tsx` | Audit log viewer |
| `OrgChart.tsx` / `Org.tsx` | Organization structure visualization |
| `Routines.tsx` / `RoutineDetail.tsx` | Recurring task management |
| `PluginManager.tsx` / `PluginPage.tsx` | Plugin lifecycle |
| `CompanySettings.tsx` | Company configuration |
| `CompanySkills.tsx` | Skill management |
| `CompanyExport.tsx` / `CompanyImport.tsx` | Company portability |
| `Auth.tsx` / `CliAuth.tsx` | Authentication flows |
| `NewAgent.tsx` | Agent creation wizard |
| `InstanceSettings.tsx` | Instance-level configuration |
| `ExecutionWorkspaceDetail.tsx` | Workspace inspection |

### Key UI Patterns
- **TanStack React Query** for all server state (caching, invalidation, optimistic updates)
- **Radix UI** primitives for accessible, composable components
- **Tailwind CSS** utility-first styling
- **WebSocket** connection for real-time updates (live events from server)
- **MDX Editor** for rich markdown editing in issue descriptions/documents
- **Mermaid** for rendering diagrams
- **React Router v7** for SPA routing

### Component Architecture
- Context providers: company context, theme, live updates, dialog management
- Shared component library under `ui/src/components/`
- Page-specific components co-located with pages

---

## 8. CLI

The CLI (`paperclipai` npm package) provides:

| Command | Purpose |
|---------|---------|
| `onboard` | Initial setup wizard |
| `configure` | Instance configuration management |
| `doctor` | Diagnose configuration issues |
| `auth` | Authentication management |
| `database` | DB operations (migrate, reset, backup) |
| `agent` | Agent management (create, configure, local-cli) |
| `worktree` | Git worktree management for parallel dev |
| `issue` | Issue CRUD from terminal |
| `heartbeat` | Trigger and inspect heartbeat runs |
| `start` / `stop` | Server lifecycle |

**Config location:** `~/.paperclip/instances/{instanceId}/config.json`

---

## 9. Agent Adapter System

Adapters bridge Paperclip to any agent runtime. Each adapter implements a standard interface for:
- Starting a heartbeat run
- Injecting environment variables
- Managing agent processes
- Handling timeouts and graceful shutdown

### Built-in Adapters (7)

| Adapter | Package | Target Runtime |
|---------|---------|----------------|
| Claude Code (Local) | `@paperclipai/adapter-claude-local` | Claude Code CLI |
| Codex (Local) | `@paperclipai/adapter-codex-local` | OpenAI Codex CLI |
| Cursor (Local) | `@paperclipai/adapter-cursor-local` | Cursor IDE |
| Gemini (Local) | `@paperclipai/adapter-gemini-local` | Google Gemini CLI |
| OpenCode (Local) | `@paperclipai/adapter-opencode-local` | OpenCode CLI |
| PI (Local) | `@paperclipai/adapter-pi-local` | PI CLI agent |
| OpenClaw Gateway | `@paperclipai/adapter-openclaw-gateway` | OpenClaw WebSocket |

### Adapter Configuration
Each agent has:
- `adapterType` — which adapter to use
- `adapterConfig` — adapter-specific settings (cwd, timeoutSec, graceSec, maxTurnsPerRun, etc.)
- `runtimeConfig` — heartbeat settings (enabled, cooldownSec, intervalSec, wakeOnDemand, maxConcurrentRuns)

### Creating a New Adapter
1. Create a new package in `packages/adapters/your-adapter/`
2. Implement the adapter interface from `@paperclipai/adapter-utils`
3. Register it in the server's adapter registry
4. Add it to the workspace dependencies

---

## 10. Plugin System

Paperclip has a plugin system for extending functionality:

- **Plugin SDK** in `packages/plugins/`
- Plugins run as **isolated worker processes** for safety
- Plugin lifecycle: install → configure → enable → run
- Plugins can register webhooks, scheduled jobs, and react to events
- Plugin state is persisted in dedicated tables (`plugin_state`, `plugin_config`, etc.)

### Key Plugin Tables
- `plugins` — installed plugin registry
- `plugin_config` — per-plugin configuration
- `plugin_company_settings` — company-scoped plugin settings
- `plugin_entities` — plugin-managed data entities
- `plugin_jobs` — scheduled plugin tasks
- `plugin_logs` — plugin execution logs
- `plugin_state` — persistent plugin state
- `plugin_webhooks` — registered webhook endpoints

---

## 11. Skills System

Skills are **injected instruction bundles** that give agents domain-specific knowledge at runtime. Unlike plugins (which run code), skills are prompt/documentation packages.

Located in `skills/`:
- `paperclip/` — core Paperclip API interaction skill
- Skills are managed via company skills API
- Agents can have skills assigned via `POST /api/agents/{agentId}/skills/sync`
- Skills can be scanned from project workspaces

---

## 12. Heartbeat Execution Model

This is the **core orchestration pattern** and the most important concept to understand.

### How it Works
1. **Trigger** — Something requests an agent wake up (task assignment, comment mention, schedule, manual trigger)
2. **Wakeup Request** — Server creates a `agent_wakeup_requests` record
3. **Heartbeat Orchestrator** — Background service polls for pending wakeups
4. **Adapter Dispatch** — Server calls the appropriate adapter to start the agent
5. **Environment Injection** — Adapter sets `PAPERCLIP_*` env vars (agent ID, company ID, API URL, run JWT, task ID, wake reason)
6. **Agent Execution** — Agent wakes, reads inbox, checks out task, does work, updates status
7. **Run Tracking** — All activity logged in `heartbeat_runs` and `heartbeat_run_events`
8. **Completion** — Agent exits, adapter reports completion, run marked finished

### Heartbeat Environment Variables
```
PAPERCLIP_AGENT_ID        — Agent's UUID
PAPERCLIP_COMPANY_ID      — Company UUID
PAPERCLIP_API_URL         — Server base URL
PAPERCLIP_API_KEY         — Short-lived JWT for this run
PAPERCLIP_RUN_ID          — Heartbeat run UUID (for audit trail)
PAPERCLIP_TASK_ID         — Triggering issue UUID (optional)
PAPERCLIP_WAKE_REASON     — Why the agent was woken
PAPERCLIP_WAKE_COMMENT_ID — Specific comment that triggered wake (optional)
PAPERCLIP_APPROVAL_ID     — Approval to process (optional)
PAPERCLIP_APPROVAL_STATUS — Approval resolution status (optional)
PAPERCLIP_LINKED_ISSUE_IDS — Comma-separated linked issues (optional)
```

### Task Lifecycle
```
backlog → todo → in_progress → done
                      ↓
                   blocked → (unblocked) → in_progress
                      ↓
                   escalated to manager
```

### Atomic Checkout
- `POST /api/issues/{id}/checkout` — Claims exclusive ownership
- Returns `409 Conflict` if another agent holds the task
- Prevents concurrent work on the same task
- This is a **critical invariant** — never bypass it

---

## 13. Governance & Approvals

Paperclip has a built-in approval system for governed actions:

- **Hiring** — New agent creation requires board approval
- **Budget changes** — Significant budget modifications need approval
- **Cross-team delegation** — Tasks crossing team boundaries may require approval

### Approval Flow
1. Agent or system creates an approval request
2. Board user reviews in the Approvals page
3. Approved → linked actions proceed; Rejected → actions rolled back
4. Agents can be woken with `PAPERCLIP_APPROVAL_ID` to process outcomes

---

## 14. Budget & Cost Tracking

- **Cost Events** — Every agent action that costs money is logged
- **Budget Policies** — Set monthly spending limits per agent
- **Budget Incidents** — Automatic alerts when thresholds are crossed
- **Auto-pause** — Agents are automatically paused at 100% budget utilization
- **80% Warning** — Above 80%, agents should focus on critical tasks only
- **Finance Events** — Higher-level financial tracking

---

## 15. Deployment Modes

### Server Modes
| Mode | Auth | Exposure | Use Case |
|------|------|----------|----------|
| `local_trusted` | Implicit (no login) | `private` | Local development, single-user |
| `authenticated` | Email/password | `private` or `public` | Production, multi-user |

### Database Modes
| Mode | Technology | Use Case |
|------|-----------|----------|
| Embedded PGlite | In-process SQLite-like PG | Dev, quick start |
| Docker PostgreSQL | PostgreSQL 17 container | Local production |
| External PostgreSQL | Any PostgreSQL 17 | Cloud production (Supabase, etc.) |

### Storage Modes
| Mode | Backend | Use Case |
|------|---------|----------|
| `local_disk` | Filesystem | Local/dev |
| `s3` | AWS S3 / compatible | Production |

---

## 16. Development Workflow

### Quick Start
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start server + UI in dev mode
```

Server runs at `http://localhost:3100` (API + UI served together in dev).

### Key Commands
```bash
pnpm build            # Build all packages
pnpm dev              # Dev mode with hot reload
pnpm test             # Run Vitest tests
pnpm db:generate      # Generate DB migration after schema change
pnpm db:migrate       # Apply migrations
pnpm lint             # Lint all packages
```

### Making Changes (The Contract)
When modifying the system, always update all impacted layers:
1. `packages/db` — Schema changes
2. `packages/shared` — Type/constant/validator changes
3. `server` — Route and service changes
4. `ui` — Client-side changes

### Worktree Support
The CLI supports git worktrees for parallel development:
```bash
paperclipai worktree create feature-x
paperclipai worktree list
```

---

## 17. Testing Infrastructure

### Unit/Integration Tests
- **Framework:** Vitest
- **Config:** `vitest.config.ts` at repo root
- **Run:** `pnpm test`

### End-to-End Tests
- **Framework:** Playwright
- **Location:** `tests/`
- **Covers:** Onboarding smoke test, critical user flows

### Eval Framework
- **Tool:** PromptFoo
- **Location:** `evals/`
- **Purpose:** Evaluate agent prompt quality and behavior

### Release Smoke Tests
- Docker-based smoke tests in `Dockerfile.onboard-smoke`
- Validates the full onboarding flow in a container

---

## 18. Key Invariants & Design Decisions

These are **non-negotiable** rules of the system. Breaking them will cause bugs:

1. **Company scoping** — Every entity is scoped to a company. Cross-company data access must never happen.
2. **Single assignee model** — One agent per task. Enforced by atomic checkout (409 on conflict).
3. **Checkout before work** — Agents must POST checkout before modifying a task. Never PATCH to `in_progress` directly.
4. **Budget hard-stop** — Agents auto-pause at 100% budget. This is a safety mechanism.
5. **Activity logging** — All mutating actions are logged for audit. The activity log is append-only.
6. **Heartbeat isolation** — Each heartbeat run is independent. Agents don't maintain state between runs.
7. **Adapter abstraction** — The server never talks directly to agent runtimes. Always through adapters.
8. **Run ID tracing** — All mutating API calls must include `X-Paperclip-Run-Id` for audit linkage.

---

## 19. Modification Guide: How to Make It Ours

### Branding & Identity
- **Company name/logo:** Managed in the UI via Company Settings — no code change needed
- **UI branding:** Modify `ui/src/` components and Tailwind theme
- **Email templates:** If adding email notifications, add to server services

### Adding a New Agent Adapter
1. Create `packages/adapters/your-adapter/`
2. Copy structure from an existing adapter (e.g., `claude-local`)
3. Implement the adapter interface: `start()`, `stop()`, `getStatus()`
4. Register in `server/src/services/` adapter registry
5. Add to `pnpm-workspace.yaml` and server `package.json`

### Adding a New API Endpoint
1. Define the route in `server/src/routes/your-route.ts`
2. Create the service in `server/src/services/your-service.ts`
3. Add shared types/validators in `packages/shared/`
4. If DB changes needed, update `packages/db/src/schema/`
5. Register route in `server/src/routes/index.ts`

### Adding a New UI Page
1. Create the page component in `ui/src/pages/YourPage.tsx`
2. Add route in the React Router config
3. Add navigation entry in the sidebar
4. Use TanStack React Query for data fetching
5. Use existing Radix UI components for consistency

### Adding a New Database Table
1. Create schema file: `packages/db/src/schema/your_table.ts`
2. Export from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate`
4. Add types to `packages/shared/`
5. Create service + route in server
6. Build: `pnpm build`

### Custom Plugins
1. Use the Plugin SDK from `packages/plugins/`
2. Plugins run as isolated workers — safe for experimentation
3. Can register webhooks, jobs, and event handlers
4. State persisted via plugin tables

### Custom Skills
1. Create a skill definition in `skills/your-skill/`
2. Register via company skills API
3. Assign to agents via skills sync endpoint
4. Skills are prompt bundles — no code execution risk

### Environment & Configuration
- **Instance config:** `~/.paperclip/instances/{id}/config.json`
- **Server config:** Environment variables or config file
- **Database:** Switch modes in config (embedded → Docker → external)
- **Storage:** Switch from local_disk to S3 in config

### Running a Parallel Instance
To run our fork alongside the production instance:
1. Clone our fork to a separate directory
2. Use a different port (e.g., 3200 instead of 3100)
3. Use a separate database (different embedded dir or different PG database)
4. Configure in a separate instance config
5. Both instances run independently

```bash
# In our fork directory:
PAPERCLIP_PORT=3200 pnpm dev
# Or configure via ~/.paperclip/instances/darwin/config.json
```

---

## 20. Risk Areas & Gotchas

### Things to Watch Out For

1. **Schema migrations** — Drizzle migrations are sequential. If upstream adds migrations while we have custom ones, merging gets complex. Strategy: keep our schema changes in clearly named files.

2. **Adapter compatibility** — Adapters are tightly coupled to the specific CLI versions of Claude Code, Codex, etc. Updates to those tools may break adapters.

3. **Company scoping bugs** — The #1 invariant. Any new feature must enforce company scoping. Missing scoping = data leak between companies.

4. **Heartbeat race conditions** — The checkout system prevents most races, but custom modifications to the heartbeat flow need careful testing.

5. **Budget enforcement** — The auto-pause system is critical for cost control. Custom features that trigger agent runs must respect budget checks.

6. **Plugin isolation** — Plugins run in workers, but they share the same PostgreSQL. A misbehaving plugin could impact DB performance.

7. **Upstream sync** — We'll need a strategy for pulling upstream changes. Recommended: rebase-based workflow with careful conflict resolution on schema files.

### Recommended Upstream Sync Strategy
```bash
# Add upstream remote (already configured by gh fork)
git remote -v  # Verify upstream exists

# Periodic sync
git fetch upstream
git rebase upstream/master
# Resolve conflicts, especially in:
#   - packages/db/src/schema/
#   - server/src/routes/
#   - server/src/services/
```

---

## Appendix A: File Counts by Area

| Area | Files | Primary Language |
|------|-------|-----------------|
| Server | 238+ | TypeScript |
| UI | 100+ | TypeScript/React |
| CLI | 30+ | TypeScript |
| DB Schema | 60+ | TypeScript |
| Shared | 40+ | TypeScript |
| Adapters (7) | 7+ packages | TypeScript |
| Tests | 10+ | TypeScript |
| Documentation | 30+ | Markdown |

## Appendix B: Key File Locations

| What | Where |
|------|-------|
| Server entry | `server/src/index.ts` |
| Route definitions | `server/src/routes/` |
| Service layer | `server/src/services/` |
| DB schema | `packages/db/src/schema/` |
| DB migrations | `packages/db/drizzle/` |
| Shared types | `packages/shared/src/` |
| UI pages | `ui/src/pages/` |
| UI components | `ui/src/components/` |
| Adapter packages | `packages/adapters/` |
| Plugin SDK | `packages/plugins/` |
| Skills | `skills/` |
| CLI commands | `cli/src/` |
| Config | `~/.paperclip/instances/` |
| Dev docs | `doc/` |
| Implementation spec | `doc/SPEC-implementation.md` |
| Product spec | `doc/PRODUCT.md` |
| Architecture plans | `doc/plans/` |

---

*This document should be treated as a living reference. As we modify the system, update the relevant sections to keep it accurate.*
