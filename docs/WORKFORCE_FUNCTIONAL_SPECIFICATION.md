# SQUAD FUNCTIONAL SPECIFICATION v3.1

**Version:** 3.1
**Date:** April 2026
**Status:** Approved — Canonical
**Owner:** Stepan Korec
**Repository:** `stepan-korec/workforce` (Paperclip fork + orchestrator)
**Target project:** `stepan-korec/trading-agent`
**Supersedes:** SQUAD_FUNCTIONAL_SPECIFICATION v3.0 (Feb 2026)

---

## 1. Purpose

This document is the complete product specification for the Kaizai Agentic Workforce — an autonomous software development team that builds, tests, reviews, deploys, and maintains the Kaizai Trading Agent platform under human oversight.

The workforce operates like a real software house: the human brings projects, sets budgets, and represents the end customer. Everything else — planning, implementation, testing, code review, merging, deployment, and reporting — is handled autonomously with full transparency.

---

## 2. Architecture Overview

### 2.1 System Topology

The workforce operates across five systems, each owning a specific domain:

| System | Role | Owns |
|---|---|---|
| **Paperclip** (fork) | Control plane | Agent management, org chart, budgets, heartbeats, dashboard |
| **LangGraph** (orchestrator) | Execution engine | Workflow routing, LLM reasoning, tool calls, state persistence |
| **GitHub** | System of record | Issues, PRs, Projects V2, code, CI/CD, Actions, merge history |
| **LangSmith** | Observability | LLM traces, tool calls, token usage, decision rationale |
| **Slack** | Conversation | Human ↔ Scrum Master dialogue, exception alerts, interventions |

### 2.2 Repository Structure

The workforce is a standalone product in its own repository, separate from the trading platform it builds.

| Repository | Contents |
|---|---|
| `stepan-korec/workforce` | Paperclip fork + LangGraph orchestrator + Claude Code Runner + agent definitions |
| `stepan-korec/trading-agent` | Trading platform source, specs, docs, CI/CD, GitHub Projects V2 board |

The workforce interacts with the trading-agent repo exclusively via GitHub API (issues, PRs, merges) and Claude Code Runner (clones, writes code, pushes branches). There is zero code coupling between the repositories.

```
workforce/                              # Paperclip fork
├── ui/                                 # Paperclip dashboard (React)
├── server/                             # Paperclip API (Express)
├── packages/                           # Paperclip packages + adapters
├── orchestrator/                       # LangGraph execution engine
│   ├── src/
│   │   ├── nodes/                      # Agent node implementations
│   │   │   ├── scrum_master.py
│   │   │   ├── code_operator.py
│   │   │   ├── architect.py
│   │   │   ├── test_lead.py
│   │   │   ├── po.py
│   │   │   └── infra_lead.py
│   │   ├── tools/                      # GitHub, Slack, job executor wrappers
│   │   ├── state.py                    # SDLCState dataclass
│   │   ├── graph.py                    # Graph definition (nodes, edges, routing)
│   │   ├── llm.py                      # ChatAnthropic + cost tracking
│   │   ├── memory.py                   # Sliding window conversation manager
│   │   └── main.py                     # Entrypoint
│   ├── agents/                         # Agent identity (SOUL.md + HEARTBEAT.md)
│   │   ├── scrum_master/
│   │   ├── code_operator/
│   │   ├── architect/
│   │   ├── test_lead/
│   │   ├── product_owner/
│   │   └── infra_lead/
│   ├── config/kaizai.yaml              # Project-specific configuration
│   ├── Dockerfile
│   └── requirements.txt
├── runner/                             # Claude Code Runner
│   ├── Dockerfile
│   └── entrypoint.sh
├── deploy/vps/                         # VPS deployment
│   ├── docker-compose.yml
│   └── .env.template
└── docs/                               # Workforce specifications
```

### 2.3 Integration Architecture

```
Human (Board of Directors / End Customer)
  │
  ├── Slack ──────────────► Scrum Master (natural language)
  ├── Paperclip Dashboard ► Agent visibility, budget, heartbeats
  └── GitHub Projects V2 ─► Project visibility, roadmap, issues
  
Paperclip (Control Plane)
  ├── Heartbeat scheduler → wakes Scrum Master every 15 min
  ├── Agent registry → 6 agents (4 active, 2 paused)
  ├── Budget enforcement → per-project monthly limits
  ├── GitHub Connection → read-only sync for dashboard visibility
  └── HTTP adapter → invokes LangGraph orchestrator

LangGraph (Execution Engine)
  ├── Stateful graph → risk routing, retry loops, agent sequencing
  ├── ChatAnthropic → LLM reasoning with LangSmith auto-tracing
  ├── GitHub tools → issues, PRs, reviews, merges (via GitHub App)
  ├── Job executor → dispatches Claude Code Runner containers
  └── PostgreSQL checkpoints → state persistence across restarts
```

---

## 3. Autonomy Model

**Core principle:** Start with maximum autonomy and comprehensive observability. Add constraints only where observed system behavior demonstrates they are needed.

### 3.1 Operating Modes

| Environment | Mode | What it means |
|---|---|---|
| **Dev / QA** | Human-on-the-loop (HOTL) | Agents execute autonomously. Human has full visibility (Paperclip, GitHub Projects, LangSmith, Slack). Human intervenes only when they choose to. |
| **Production** | Human-in-the-loop (HITL) | Production deploys require explicit human approval via GitHub Environment protection. Everything before production is autonomous. |

### 3.2 What Is Autonomous (Dev/QA)

| Activity | Autonomous? | Notes |
|---|---|---|
| Story planning (decompose roadmap into issues) | Yes | PO creates GitHub Issues. Human sees them in Projects V2. |
| Story assignment and prioritization | Yes | Scrum Master reads priority, picks next story. |
| Code implementation (Claude Code Runner) | Yes | Code Operator dispatches jobs autonomously. |
| Architecture review (high-risk code) | Yes | Architect reviews and approves/blocks autonomously. |
| Test execution and validation | Yes | Test Lead triggers tests, validates AC, checks invariants. |
| PR merge (normal code) | Yes | Auto-merge when all checks pass. |
| PR merge (high-risk code) | Yes | Auto-merge when Architect + Test Lead both approve. |
| Retry on failure | Yes | Up to 3 retries before escalation. |
| Cost tracking and budget enforcement | Yes | Hard stop at budget limit. |
| Memory writes (durable docs) | Yes | Via PR (goes through standard merge flow). |

### 3.3 What Is Gated

Only two categories require human approval:

**Production deployment:** Enforced by GitHub Environment protection rules. The agent prepares the deployment, summarizes what would ship, and waits for human approval.

**Protected path changes:** Enforced by CODEOWNERS in the trading-agent repo.

### 3.4 Protected Paths (CODEOWNERS)

| Path | Why protected |
|---|---|
| `.github/workflows/**` | CI/CD pipeline definitions |
| `infra/**` | Infrastructure definitions |
| `contracts/**` | Protobuf shared contracts |
| `CLAUDE.md` | System-level prompt rules |
| `DOCUMENT_REGISTRY.yaml` | Controls what agents can read |
| `docs/specs/*` | Functional spec, architecture spec |

`agent-workforce/` is NOT protected — agents can self-modify their own orchestrator code.

### 3.5 Risk Tiers

Risk tiers determine the depth of autonomous review, not whether a human is involved.

| Tier | Route | Path patterns |
|---|---|---|
| **Normal** | Code Operator → Test Lead → auto-merge | Everything not listed below |
| **High-risk** | Code Operator → Architect → Test Lead → auto-merge | `services/*/auth*`, `services/*/tenant*`, `services/*/migrations/*` |
| **Protected** | Human approval required (CODEOWNERS) | See §3.4 |

### 3.6 Guardrail Addition Process

Guardrails are added reactively based on observed behavior, not proactively based on fear:

1. **Observe:** Human notices a pattern via LangSmith or GitHub
2. **Discuss:** Tell the Scrum Master in Slack
3. **Persist:** Add to CLAUDE.md or agent SOUL.md via PR
4. **Verify:** Watch subsequent stories to confirm the guardrail works

### 3.7 Intervention Model

The human interacts with the Scrum Master via natural language in Slack:

| Capability | Example | Internal action |
|---|---|---|
| Pause story | "Hold on, stop that story" | `workflow_stage = "paused"` |
| Resume story | "OK continue" | Restore pre-pause stage |
| Cancel running job | "Kill that job" | Terminate container |
| Explain decision | "Why did you change the ledger?" | Read LangSmith trace, summarize |
| Reprioritize | "Do the auth stories first" | Update GitHub issue priority |
| Freeze risk class | "Don't touch settlement code" | Add constraint to config |

---

## 4. Agents

### 4.1 Agent Roster

| Agent | Role | Activation | Paperclip Status |
|---|---|---|---|
| Scrum Master | Central orchestrator, human interface | Heartbeat (15 min) + Slack events + task assignment | Active |
| Code Operator | Claude Code job dispatch | Invoked by Scrum Master | Active |
| Architect | Strategic PR review (high-risk only) | Invoked for high-risk PRs | Active |
| Test Lead | AC validation, test execution, invariant checks | Invoked after Code Operator | Active |
| Product Owner | Roadmap decomposition → GitHub Issues | Invoked by Scrum Master | Paused (Phase 3) |
| Infrastructure Lead | Deployment, health verification, rollback | Invoked after merge | Paused (Phase 3) |

### 4.2 Agent Identity System

Each agent has two identity files in `orchestrator/agents/<name>/`:

**SOUL.md** — Who the agent is. Principles, boundaries, review criteria. Persistent across all invocations. Read by the LangGraph node at startup and injected into the ChatAnthropic system prompt.

**HEARTBEAT.md** — What the agent does on each invocation. Step-by-step protocol. Read on each heartbeat or invocation.

Changing agent behavior = editing a markdown file. Since `orchestrator/` is not a protected path, these changes auto-merge through the normal flow.

### 4.3 Agent Implementation

All agents use `ChatAnthropic` (not raw Anthropic SDK) for LangSmith auto-tracing. Each agent is a LangGraph node that:

1. Reads its SOUL.md and HEARTBEAT.md at invocation
2. Receives the shared `SDLCState` from the graph
3. Makes LLM-backed decisions via ChatAnthropic tool-use
4. Returns updated state to the graph
5. The graph routes to the next agent based on conditional edges

### 4.4 Scrum Master

The central orchestrator and sole human interface.

**Activation:** Three triggers:
- Heartbeat (every 15 min) — proactive housekeeping
- Slack message — human conversation
- Paperclip task assignment — new work

**Tools:** `get_open_issues`, `assign_issue`, `merge_pr`, `update_issue_labels`, `close_issue`, `post_to_slack`, `check_budget`, `sync_status`

**Key behaviors:**
- Never writes code. Never approves its own work.
- Never redirects humans to other agents — owns the human interface.
- Classifies PR risk and routes accordingly.
- Escalates after 3 failed retries.

### 4.5 Code Operator

Dispatches Claude Code Runner jobs to implement stories.

**Tools:** `dispatch_code_job`, `check_job_status`, `find_pr_for_branch`, `create_pr`, `get_pr_diff`

**Sprint contracts:** Before dispatching, negotiates with the Test Lead on what "done" looks like — specific test criteria agreed before coding begins.

**Retry context:** On retries, includes specific failure details so Claude Code can make targeted fixes.

### 4.6 Architect

Guards the strategic direction. Reviews high-risk PRs only.

**When invoked:** Only for code touching `services/*/auth*`, `services/*/tenant*`, `services/*/migrations/*`.

**Tools:** `get_pr_diff`, `get_file_contents`, `fetch_document`, `post_review`

**Reviews against:** Architecture spec, functional spec (invariants P1-P8), product roadmap, lessons learned.

**Authority:** Can block merges autonomously. No human confirmation needed.

### 4.7 Test Lead

Validates code against acceptance criteria and platform integrity.

**Three validation layers:**
1. SEMANTIC: Compare PR diff against acceptance criteria
2. MECHANICAL: Trigger test suite via GitHub Actions, read results
3. FINANCIAL INVARIANTS: P1 zero-sum, P2 fail-closed, P3 FIFO, P4 intent fence

**Tools:** `get_pr_diff`, `get_issue_acceptance_criteria`, `trigger_test_workflow`, `get_workflow_results`, `get_file_contents`, `post_pr_review`

**Workflow selection:** Platform code → `run-tests.yml`. Workforce code → `test-workforce.yml`. Mixed → both.

### 4.8 Product Owner (Phase 3 — Paused)

Translates roadmap into GitHub Issues with acceptance criteria.

**Constraints:** Stories trace to roadmap exit criteria. Max ~300 LOC per story. Never reads from `docs/archive/`.

### 4.9 Infrastructure Lead (Phase 3 — Paused)

Manages VPS deployment, health verification, rollback.

**Dev:** Fully autonomous. **Production:** Human approval required.

**Verification:** Health endpoint + MCP inspection (container status, logs, DB connectivity).

---

## 5. Execution Engine (LangGraph)

### 5.1 State Schema

The `SDLCState` dataclass carries all context through the graph:

- Story context (issue number, body, labels, AC)
- Code Operator state (job ID, PR number, PR diff)
- Test Lead state (test passed, failure report)
- Orchestration (workflow stage, human decision, messages)
- Cost tracking (per-story costs, budget thresholds)
- Error tracking (error type, context, retry count)
- Project config (risk patterns, budget limits, execution backend)

### 5.2 Graph Structure

```
                    ┌─────────────────┐
                    │  Scrum Master   │ ◄── Heartbeat / Slack / Assignment
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Code Operator  │ ──► Claude Code Runner
                    └────────┬────────┘
                             │
                   ┌─────────┴──────────┐
                   │                    │
            [high-risk?]          [normal]
                   │                    │
          ┌────────▼────────┐   ┌───────▼────────┐
          │   Architect     │   │   Test Lead    │
          └────────┬────────┘   └───────┬────────┘
                   │                    │
          ┌────────▼────────┐          │
          │   Test Lead     │          │
          └────────┬────────┘          │
                   │                    │
                   └────────┬───────────┘
                            │
                   [tests pass?]
                   │              │
              [yes: merge]   [no: retry ≤3]
                   │              │
          ┌────────▼──────┐   ┌──▼─────────────┐
          │  Auto-merge   │   │  Code Operator  │ (retry)
          └───────────────┘   └────────────────┘
```

### 5.3 Routing Logic

Routing is hybrid:
- **LangGraph edges** handle structural routing (risk tier classification, retry loops, node sequencing). This is deterministic and testable.
- **SOUL.md / HEARTBEAT.md** shape how each agent thinks and acts within its node. This is configurable without code changes.

### 5.4 State Persistence

LangGraph PostgreSQL checkpointer persists state across container restarts. Database: `langgraph_state` on db-01, ringfenced from `trading_data` and `paperclip`.

### 5.5 Memory Management

Three tiers:
- **Working memory:** Context window (current conversation)
- **Story memory:** `state.messages` sliding window (max 50 messages, summarized on overflow)
- **Persistent memory:** Durable docs (`AGENT_MEMORY.md`, `LESSONS_LEARNED.md`) written via PR to the trading-agent repo

---

## 6. Control Plane (Paperclip)

### 6.1 Role

Paperclip is the workforce management layer — the "HR system" for AI agents. It does NOT manage tasks or project data (that's GitHub). It manages the team.

### 6.2 What Paperclip Provides

| Capability | Description |
|---|---|
| Agent registry | 6 agents with roles, reporting lines, status |
| Org chart | Visual hierarchy: Scrum Master → Code Operator, Architect, Test Lead, PO, Infra Lead |
| Heartbeat scheduler | Wakes Scrum Master every 15 minutes |
| Budget enforcement | Per-project monthly limits with auto-pause at 100% |
| Run logging | Every heartbeat run recorded with duration, cost, outcome |
| Dashboard | Web UI at `build.kaizai.co` — unified view of agents + project status |
| Session persistence | Agents resume context across heartbeats via session IDs |

### 6.3 GitHub Connection

A custom entity in the Paperclip fork that links a company to one or more GitHub repos. Provides read-only project visibility in the Paperclip dashboard:

| Widget | Data source |
|---|---|
| Issue summary | GitHub Issues API (open/in-progress/done counts) |
| Recent activity | GitHub Events API (last 10 updates, merges, deploys) |
| PR pipeline | GitHub Pulls API (open PRs with check status) |
| Phase progress | GitHub Projects V2 API (issues by phase label, completion %) |
| Agent ↔ Issue mapping | Paperclip runs + GitHub Issues |

GitHub is the system of record. Paperclip reads and displays, never writes project data.

### 6.4 Budget Model

Per-project budgets. Budget allocated to the trading-agent project, tracked across all agents working on it. When the project budget is exhausted, all agents on that project pause.

Paperclip enforces macro budget (monthly per-project). LangGraph's `CostTrackingCallback` tracks micro costs (per-story alerts).

### 6.5 Paperclip Adapter

Paperclip invokes the LangGraph orchestrator via HTTP adapter. On each heartbeat or event:

1. Paperclip POSTs to orchestrator `/invoke` endpoint
2. LangGraph graph runs (pick up work, dispatch, review, merge)
3. Orchestrator calls Paperclip API to log costs and run outcome
4. Paperclip records the run and updates the dashboard

---

## 7. Project Management (GitHub)

### 7.1 GitHub Issues

GitHub Issues are the system of record for all work items. Each issue has:
- Title and description with acceptance criteria
- Labels: `phase/*`, `priority/*`, `type/*`, `status/*`
- Assignee (mapped to agent via Scrum Master)
- Linked PRs (auto-linked via `Closes #N`)

### 7.2 GitHub Projects V2

A GitHub Projects V2 board on the trading-agent repo provides:
- **Kanban view:** Issues grouped by status (Backlog → Todo → In Progress → In Review → Done)
- **Roadmap view:** Timeline by phase with date fields
- **Table view:** Sortable by priority, phase, story points
- **Charts:** Cycle velocity, status distribution, phase progress

Custom fields: Phase, Risk Tier, Story Points, Agent Assigned.

### 7.3 Why Not Linear

Linear was evaluated and dropped. GitHub Projects V2 provides the same portfolio visibility natively, without sync overhead. Paperclip replaces Linear's agent supervision role.

---

## 8. Claude Code Integration

### 8.1 Claude Code Runner

The Claude Code Runner is a Docker container that executes coding jobs. It clones the trading-agent repo, reads `CLAUDE.md` from it, receives the story context as a system prompt, writes code, runs tests, and pushes a branch.

**Image location:** `workforce/runner/Dockerfile` + `entrypoint.sh`
**Invocation:** Code Operator dispatches via `JobExecutor` abstraction

### 8.2 JobExecutor Abstraction

```python
class JobExecutor(ABC):
    async def dispatch(self, issue_number, issue_body, git_token, retry_context="") -> str
    async def poll_status(self, execution_id) -> dict

class VpsDockerExecutor(JobExecutor):  # Primary
class AzureJobExecutor(JobExecutor):   # Fallback (deferred)
```

Config-driven selection: `execution.backend: "vps_docker"` in `kaizai.yaml`.

### 8.3 Claude Code Features Adopted

| Feature | Status | Purpose |
|---|---|---|
| `CLAUDE.md` (root) | ✅ Active | Platform context for Claude Code Runner |
| Skills (`.claude/skills/`) | Planned | Domain-specific guides (migration, ledger, testing, API design) |
| Hooks (PreToolUse/PostToolUse) | Planned | Block writes to protected paths, auto-lint after edits |
| `settings.json` permissions | Planned | Replace `--dangerously-skip-permissions` with explicit allow/deny |
| Subfolder CLAUDE.md | Planned | Per-service context (e.g., `services/pnl-service/CLAUDE.md`) |

### 8.4 Sprint Contracts

Before coding begins, the Code Operator and Test Lead negotiate a sprint contract:

1. Code Operator proposes implementation plan + test criteria
2. Test Lead reviews and agrees (or pushes back)
3. Code Operator dispatches Claude Code Runner with the agreed contract
4. Test Lead validates against the contract (not just the original AC)

This catches misunderstandings before code is written, not after.

---

## 9. Observability

### 9.1 Observability Stack

| Layer | Tool | What it shows |
|---|---|---|
| Agent operations | Paperclip dashboard | Agent health, budget, heartbeats, run history, org chart |
| Project progress | GitHub Projects V2 | Issues by status/phase, roadmap timeline, PR pipeline |
| Engineering artifacts | GitHub | Code, PRs, checks, merge history, deployments |
| Runtime execution | LangGraph / PostgreSQL | Workflow stage, active stories, cost, retry counts |
| Reasoning traces | LangSmith | Prompts, completions, tool calls, token usage, decision rationale |
| Conversation | Slack | Agent updates, human commands, intervention history |

### 9.2 What Gets Traced (LangSmith)

Every LLM call (prompt, completion, tool selection, token count), every tool execution (input, output, duration, errors), every state transition, every human interaction, every decision point.

### 9.3 Slack Policy

Slack is for exceptions and conversation, not status reports:
- Story completed (with cost summary)
- Escalations (max retries exceeded)
- Budget alerts (80%, 95%, 100%)
- Human-initiated conversations
- Anomalies (unexpected failures)

---

## 10. Infrastructure

### 10.1 VPS Deployment

Single VPS (app-01, `217.216.109.16`). Three containers added alongside the existing trading platform stack:

| Container | Image | Purpose |
|---|---|---|
| `paperclip` | Built from workforce repo root Dockerfile | Control plane + dashboard |
| `langgraph-orchestrator` | Built from `orchestrator/Dockerfile` | Execution engine |
| Claude Code Runner | Built from `runner/Dockerfile` | Spawned per coding job |

Dashboard exposed at `build.kaizai.co` via Caddy reverse proxy with Paperclip built-in auth.

### 10.2 Database Architecture

Three databases on db-01, fully ringfenced:

| Database | User | Purpose |
|---|---|---|
| `trading_data` | `trading_user` | Trading platform operational data |
| `langgraph_state` | `langgraph_user` | LangGraph checkpoints, workflow state |
| `paperclip` | `paperclip_user` | Paperclip control plane data |

Each user has CONNECT privilege only on its own database. Cross-database access is denied.

### 10.3 Azure

Azure Container Apps for the workforce are decommissioned. `ca-langgraph-agent` will be removed. VPS is the canonical runtime. Azure remains as fallback for the trading platform services only.

### 10.4 GitHub App

Existing App `trading-agent-workforce` (ID: 2914378) reused. Installed on `stepan-korec/trading-agent` with Contents, Issues, Pull Requests, and Actions permissions.

Plan: account rename from `stepan-korec` to `kaizai` (separate step, after workforce is stable).

### 10.5 Slack

Free plan. Workspace: `trading-agent`. Channel: `#agent-workforce`. Socket Mode for inbound messages. Messages Tab enabled for DM capability.

### 10.6 DNS

| Subdomain | Target | Purpose |
|---|---|---|
| `kaizai.co` | Trading platform frontend | Existing |
| `build.kaizai.co` | Paperclip dashboard (port 3100) | New |
| `mcp.kaizai.co` | VPS MCP server | Existing |

---

## 11. Configuration

### 11.1 Project Configuration (`kaizai.yaml`)

Defines the target project, autonomy model, risk tiers, execution backend, budget, and heartbeat schedule. Lives in `orchestrator/config/kaizai.yaml`.

### 11.2 Agent Configuration

Agent identity (SOUL.md) and protocol (HEARTBEAT.md) are externalized to markdown files. Changing agent behavior is a file edit, not a code change.

Agent parameters (model, adapter, budget) are configured in Paperclip via the dashboard UI or API — no code changes required.

### 11.3 Routing Configuration

Risk tier patterns are defined in `kaizai.yaml` and read by the graph's routing logic. Changing which paths are high-risk is a config edit, not a Python code change.

### 11.4 Upstream Sync

Paperclip upstream updates are pulled via:
```bash
git fetch upstream
git merge upstream/master
```

Conflicts are minimized because our additions (orchestrator/, runner/, deploy/, agents/) are in directories that don't exist in upstream Paperclip.

---

## 12. Implementation Phases

### Phase 0 — Unblock Runtime (Current)

| Task | Status |
|---|---|
| Fork Paperclip → `stepan-korec/workforce` | ✅ Done |
| Extract agent-workforce code into orchestrator/ | ✅ Done |
| Create agent SOUL.md files | ✅ Done |
| Create kaizai.yaml, docker-compose, .env.template | ✅ Done |
| Create `paperclip` database on db-01 | Pending |
| DNS `build.kaizai.co` + Caddy route | Pending |
| Deploy Paperclip + orchestrator containers | Pending |
| Create 6 agents in Paperclip | Pending |
| Fix GitHub App credential dual-path loading | Pending |
| Fix BUG-4 bot self-reply loop | Pending |
| Introduce JobExecutor abstraction | Pending |
| Align CODEOWNERS in trading-agent | Pending |
| Remove agent-workforce/ from trading-agent | Pending |

### Phase 2 — LLM-Back All Agents

| Task |
|---|
| Rewrite Scrum Master as ChatAnthropic tool-use agent |
| Rewrite Code Operator as ChatAnthropic tool-use agent |
| Implement Architect agent node |
| Implement Test Lead agent node with AC validation |
| Implement autonomous merge flow (replace human gate) |
| Implement risk tier routing in graph |
| Add CostTrackingCallback |
| Add sprint contract negotiation step |
| Add memory management (sliding window + summarization) |
| Wire document registry excluded-path enforcement |
| Claude Code Skills (`.claude/skills/`) |
| Claude Code Hooks (PreToolUse/PostToolUse) |
| Claude Code `settings.json` permissions |

### Phase 3 — Complete Agent Roster

| Task |
|---|
| Implement Product Owner agent |
| Implement Infrastructure Lead agent |
| Production deployment flow (GitHub Environment protection) |
| Playwright CLI post-deploy verification for Test Lead |
| Intervention capabilities (pause, resume, cancel, explain, freeze) |
| Budget enforcement gate with auto-pause |

### Paperclip Fork — GitHub Connection

| Task |
|---|
| Add `github_connections` table to Paperclip schema |
| Implement GitHub API sync service (polling) |
| Add dashboard widgets (issue summary, PR pipeline, phase progress) |
| Add agent ↔ issue mapping view |
| Implement per-project budget model (fork modification) |

---

## 13. Cost Model

### 13.1 Token Cost Tracking

`CostTrackingCallback` fires on every `ChatAnthropic` call. Accumulates input/output tokens, converts to USD using configured rates.

### 13.2 Budget Enforcement

| Threshold | Action |
|---|---|
| 50% | Log only |
| 80% | Slack warning |
| 95% | Slack alert |
| 100% | Hard stop — all agents pause, human notified |

### 13.3 Claude Code Runner Costs

Claude Code Runner costs are tracked separately (plan-limited). The runner reports token usage in its output, which the Code Operator reads and adds to the story cost.

---

## 14. Testing Strategy

### 14.1 Unit Tests

Graph routing, state transitions, tool schemas, risk classification, config loading, budget enforcement. Run via `pytest` in the workforce repo.

### 14.2 Integration Tests

GitHub API (real App credentials), Slack (real webhook), job executor (real container dispatch). Skipped in CI unless credentials are available.

### 14.3 Functional Tests

End-to-end workflow: issue → dispatch → code → PR → review → merge. Canary lifecycle. Run manually or on schedule.

### 14.4 Test Lead Verification

For frontend stories: Playwright CLI verification against the running dev deployment. Test Lead dispatches a verification job that exercises the UI.

### 14.5 Workflow Selection

| PR touches | Test workflow |
|---|---|
| Platform code (`services/`, `frontend/`) | `run-tests.yml` |
| Workforce code (`orchestrator/`) | `test-workforce.yml` |
| Both | Both workflows |

---

## 15. Decision Log Reference

All 33 architectural decisions are documented in `DECISION_LOG_Workforce_Architecture_v3.md`. Key decisions:

1. Autonomy-first model (HOTL in dev/QA, HITL for production only)
2. Paperclip as control plane, GitHub as system of record
3. Separate repo (`stepan-korec/workforce`)
4. Per-project budgets
5. All 6 agents created on day one (Phase 3 agents paused)
6. Linear dropped — replaced by Paperclip + GitHub Projects V2
7. Hybrid workflow logic: LangGraph edges + SOUL.md/HEARTBEAT.md
8. VPS only (Azure workforce decommissioned)
9. Sprint contracts (Code Operator ↔ Test Lead negotiation before coding)
10. Playwright CLI for post-deploy verification (not MCP server)

---

## 16. Document Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Jan 2026 | Initial spec — defensive model, Azure-only |
| 2.8 RC | Feb 2026 | Phase 1 scaffold, 3-agent model |
| 3.0 | Feb 2026 | Autonomy-first rewrite, 6 agents, Linear integration |
| 3.1 | Apr 2026 | Paperclip adoption, GitHub Projects V2, separate repo, per-project budgets, Linear dropped, GitHub Connection entity, SOUL.md/HEARTBEAT.md pattern, sprint contracts, Playwright CLI |
