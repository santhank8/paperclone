# Architecture Comparison: OpenCode Swarm vs Paperclip + OpenClaw

## Current Architecture (OpenCode Agent Swarm)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CRONTAB (Linux)                             │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │ check-agents.sh     │  │ auto-spawn-tasks.sh │                  │
│  │ (every 10 min)      │  │ (every 15 min)      │                  │
│  └──────────┬──────────┘  └──────────┬──────────┘                  │
│             │                        │                              │
│             ▼                        ▼                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              active-tasks.json (File-based Registry)         │  │
│  │  { tasks: [{ id, status, agent, prUrl, ... }] }              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ Read/Write
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ClawDeck (Separate Service)                     │
│  ┌─────────────────────┐  ┌─────────────────────┐                  │
│  │  REST API           │  │  SQLite DB          │                  │
│  │  :3335              │  │  tasks, boards      │                  │
│  └─────────────────────┘  └─────────────────────┘                  │
│                                                                     │
│  Limitations:                                                       │
│  - Local-only (no remote access)                                   │
│  - Flat task list (no hierarchy)                                   │
│  - No governance/approvals                                         │
│  - No budget tracking                                              │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ Sync status
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     TMUX SESSIONS                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ opencode-  │ │ opencode-  │ │ opencode-  │ │ opencode-  │       │
│  │ task-1     │ │ task-2     │ │ task-3     │ │ task-4     │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│        │              │              │              │               │
│        ▼              ▼              ▼              ▼               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   GIT WORKTREES                              │  │
│  │  ~/worktrees/task-1/  ~/worktrees/task-2/  ...              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ Push
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GITHUB (PRs)                                    │
│  - PR status: open/merged/conflict                                 │
│  - CI checks                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Problems:**
1. **Fragmented state** - Multiple sources of truth (JSON file, ClawDeck, GitHub)
2. **No hierarchy** - Flat task list, no goal alignment
3. **No governance** - No approval workflow
4. **Local-only** - Can't access from mobile/remote
5. **Custom scripts** - Maintenance burden, fragile
6. **No audit** - Limited logging, no activity feed

---

## New Architecture (Paperclip + OpenClaw)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PAPERCLIP (Control Plane)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    React UI Dashboard                         │  │
│  │  - Agent status grid                                          │  │
│  │  - Task board (Kanban)                                        │  │
│  │  - Org chart visualization                                    │  │
│  │  - Cost tracking                                              │  │
│  │  - Activity feed                                              │  │
│  │  - Mobile-friendly (access from anywhere)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    REST API (:3100)                           │  │
│  │  /api/companies/{id}/agents                                   │  │
│  │  /api/companies/{id}/issues                                   │  │
│  │  /api/agents/{id}/heartbeat/invoke                            │  │
│  │  /api/issues/{id}/checkout                                    │  │
│  │  /api/approvals                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL (Single Source of Truth)        │  │
│  │  - companies, agents, issues, runs, costs, approvals          │  │
│  │  - Full audit trail                                           │  │
│  │  - ACID transactions                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Scheduler + Event Triggers                 │  │
│  │  - Periodic heartbeats (configurable per agent)               │  │
│  │  - Assignment-triggered wake                                  │  │
│  │  - @-mention wake                                             │  │
│  │  - Approval resolution wake                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    │ HTTP Webhook
                                    │ (adapter: openclaw)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OPENCLAW (Execution Plane)                      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Webhook Receiver                           │  │
│  │  POST /api/webhook/{agent-name}                               │  │
│  │  - Receive heartbeat trigger                                  │  │
│  │  - Wake agent session                                         │  │
│  │  - Return result                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │  Jarvis    │ │  Coder     │ │  Sally     │ │  Mike      │       │
│  │  (CEO)     │ │  (Backend) │ │  (Frontend)│ │  (QA)      │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│        │              │              │              │               │
│        │              │              │              │               │
│        ▼              ▼              ▼              ▼               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Each agent follows Heartbeat Protocol:             │  │
│  │  1. GET /api/agents/me                                       │  │
│  │  2. GET /api/issues?assigneeAgentId=me                       │  │
│  │  3. POST /api/issues/{id}/checkout                           │  │
│  │  4. [Do the work using tools]                                │  │
│  │  5. PATCH /api/issues/{id} { status, comment }               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    │ Git push
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GITHUB (PRs + CI)                               │
│  - Same as before, but Paperclip tracks PR status                  │
│  - Auto-detect merged PRs → mark task done                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
1. **Single source of truth** - PostgreSQL holds all state
2. **Hierarchy** - Company → Goal → Project → Issue
3. **Governance** - Approval workflow for sensitive actions
4. **Remote access** - Web UI works from anywhere
5. **Platform** - Battle-tested, maintained, documented
6. **Full audit** - Every action logged with actor, timestamp

---

## Data Model Comparison

### Current (ClawDeck)

```
Task {
  id: string
  name: string
  status: "inbox" | "up_next" | "in_progress" | "in_review" | "done"
  description: string
  board_id: string
  assignee: { name, uuid }
  priority: "none" | "low" | "medium" | "high"
}
```

**Limitations:**
- No parent/child relationships
- No goal alignment
- No project grouping
- No budget/cost tracking
- No audit trail

### New (Paperclip)

```
Company {
  id, name, goal, budget
  └── Goals[] {
        id, name, description
        └── Projects[] {
              id, name, workspace
              └── Issues[] {
                    id, title, status, priority
                    parentId → Issue (hierarchy!)
                    assigneeAgentId → Agent
                    goalId → Goal (alignment!)
                    projectId → Project
                    billingCode (cost tracking!)
                  }
            }
      }
  └── Agents[] {
        id, name, role, title
        reportsTo → Agent (org chart!)
        budgetMonthlyCents
        spentMonthlyCents
        adapterType, adapterConfig
      }
  └── Runs[] {
        id, agentId, status
        startTime, endTime
        costCents
        exitCode, errorMessage
      }
}
```

**Features:**
- Full hierarchy (company → goal → project → issue)
- Goal alignment (every issue traces to company goal)
- Project workspaces (cwd, repoUrl)
- Budget tracking (per-agent, per-company)
- Complete audit trail (runs, events, costs)

---

## Migration Strategy

### What Changes

| Component | Current | New |
|-----------|---------|-----|
| Task storage | ClawDeck SQLite | Paperclip PostgreSQL |
| Task hierarchy | None | Company → Goal → Project → Issue |
| Agent management | config.json | Paperclip DB |
| Heartbeat trigger | Crontab | Paperclip scheduler |
| Monitoring | check-agents.sh | Paperclip UI |
| Approvals | None | Paperclip governance |
| Access | Local only | Web (anywhere) |

### What Stays the Same

| Component | Status |
|-----------|--------|
| OpenCode execution | Same (tmux + worktrees) |
| Git workflow | Same (branches, PRs) |
| GitHub integration | Same (gh CLI) |
| Agent models | Same (zai-coding-plan/glm-5) |
| Agent skills | Same (just add paperclip skill) |

---

## Timeline

```
Day 1: Setup Paperclip + Create Org
├── Install Paperclip
├── Run dev server
├── Create company structure
└── Create 7 agents

Day 2: Webhook Integration
├── Create webhook endpoint
├── Test heartbeat delivery
└── Verify agent wake

Day 3: Task Migration
├── Export from ClawDeck
├── Transform to Paperclip issues
└── Import to Paperclip

Day 4: Scheduling
├── Configure heartbeat intervals
├── Test event triggers
└── Verify auto-assignment

Day 5: Governance
├── Set up approval rules
├── Integrate Telegram notifications
└── Test approval workflow

Day 6: Monitoring
├── Review dashboard
├── Add custom metrics
└── Set up alerts

Day 7: Cleanup
├── Disable old crontabs
├── Archive old scripts
└── Stop ClawDeck
```

---

## Decision Point

**Do you want to proceed with Paperclip migration?**

If yes, start with:
1. `cd ~/repos/paperclip && pnpm dev`
2. Open http://localhost:3100
3. Run through onboarding

If no, continue with current OpenCode Swarm system.
