# Autonomee Business — Fork Plan

> Paperclip fork customized for Doug's AI agent-operated digital products business.
> Inspired by the Sparkwave Digital model. Built on what we know: Claude Code.

## Vision

Run a real digital products business through 8 specialized AI agents, coordinated by Paperclip as the orchestration layer. Agents research opportunities, build products, sell them, and manage operations — with human oversight at decision points.

## What We're Starting With

Paperclip gives us out of the box:

- **Company + org structure** — agents as employees with roles, reporting lines
- **Issue-based task management** — hierarchical tasks tracing back to company goals
- **Heartbeat execution** — agents wake on a cycle, pull work, report back
- **Adapter system** — pluggable agent runtimes (Claude Code local is built in)
- **Cost tracking** — per-agent token budgets, spend monitoring, auto-pause
- **Board UI** — web dashboard for full visibility into agent activity
- **Approval gates** — human review before agents act on critical decisions
- **Embedded Postgres** — zero-config local DB, Supabase for production

## What We'll Customize

### Phase 1: Strip & Configure (Week 1)

**Goal:** Get vanilla Paperclip running locally with a single company and one agent.

- Run `pnpm install && pnpm dev` — verify the dashboard loads at localhost:3100
- Create company with mission statement (digital products business)
- Create first agent (CEO/Orchestrator) using `claude_local` adapter
- Verify heartbeat loop works — agent wakes, gets prompt, executes, reports back
- Remove multi-company onboarding UX (we only need one company)
- Document our `.env` and config choices

### Phase 2: Define the 8 Agents (Week 2)

Build agents one at a time. Each agent = adapter config + instructions file + harness testing.

**Build order** (each depends on the ones before it):


| #   | Agent                   | Role                        | Adapter      | Why This Order                                                    |
| --- | ----------------------- | --------------------------- | ------------ | ----------------------------------------------------------------- |
| 1   | **Opal**                | Org Memory & Learning       | claude_local | Everything else benefits from institutional memory existing first |
| 2   | **CEO** (name TBD)      | Orchestrator & Decisions    | claude_local | Task creation, prioritization, delegation — the brain             |
| 3   | **Research** (name TBD) | Market Intel & Signals      | claude_local | Upstream of all business decisions                                |
| 4   | **Dev** (name TBD)      | Engineering                 | claude_local | Ships the actual products                                         |
| 5   | **Sales** (name TBD)    | Sales & Marketing           | claude_local | Can't sell until there's something to sell                        |
| 6   | **Content** (name TBD)  | Creative & Copy             | claude_local | Supports sales with assets                                        |
| 7   | **Ops** (name TBD)      | Infrastructure & Automation | claude_local | Automate what's working                                           |
| 8   | **QC** (name TBD)       | Quality Gate                | claude_local | Last — needs output from others to review                         |


**Per-agent setup checklist:**

- Write instructions markdown file (`config/agents/<name>.md`)
- Configure adapter (model, cwd, prompt template, max turns)
- Set heartbeat interval appropriate to role
- Define what "done" looks like for a heartbeat cycle
- Test solo: agent wakes → gets task → executes → reports
- Test integrated: agent creates/updates issues for others
- Set token budget appropriate to role complexity

### Phase 3: Goal Hierarchy & Task Flow (Week 3)

**Goal:** Wire up the Paperclip goal→project→issue chain so work traces back to the company mission.

- Define company-level goal (e.g., "Build and sell digital products profitably")
- Define team-level goals per agent domain
- Create initial projects (first product ideas from Research)
- Test the full chain: Research creates issue → CEO prioritizes → Dev picks up → QC reviews → Sales markets
- Verify the dashboard shows clear work attribution and status
- Configure approval gates: what needs human sign-off vs. agent autonomy

### Phase 4: Agent Collaboration Patterns (Week 4)

**Goal:** Agents talk to each other through Paperclip's issue system, not ad-hoc.

- Define escalation rules (when to create a blocker, when to @mention another agent)
- Test cross-agent handoffs (Research → CEO → Dev pipeline)
- Configure Opal to monitor all agent activity and capture learnings
- Set up QC as a required approval gate before issues close
- Build CEO's prioritization logic (how does it decide what matters?)
- Test failed handoff detection — what happens when work stalls?

### Phase 5: First Product Run (Week 5-6)

**Goal:** End-to-end test. Research finds opportunity → team builds → ships → sells.

- Research agent identifies a viable digital product opportunity
- CEO evaluates and greenlights
- Dev builds it
- Content creates marketing assets
- QC reviews everything
- Sales creates go-to-market plan
- Ops sets up delivery infrastructure
- Opal documents what worked and what didn't

### Phase 6: Production Hardening (Week 7+)

- Move to Supabase/hosted Postgres for durability
- Set up monitoring and alerting (agent health, spend, stalled work)
- Configure budget limits per agent with auto-pause
- Add VPS deployment option (Paperclip supports Docker)
- Build custom dashboard views for our specific workflow
- Evaluate whether any agents should use different adapters (API direct for lightweight tasks)

## Architecture Decisions

### Why Fork Paperclip (Not Build From Scratch)

Paperclip already solved the hard problems:

1. Hierarchical task management with goal tracing
2. Agent heartbeat lifecycle (wake, execute, report, sleep)
3. Adapter abstraction for pluggable runtimes
4. Cost tracking and budget enforcement
5. Web UI for visibility and control
6. Approval gates for human oversight

Building this from scratch would take months. Forking lets us focus on what matters: the agents themselves and the business logic.

### Why Claude Code Local Adapter (Not OpenClaw)

- We know Claude Code inside and out — it's our strongest harness
- The `claude_local` adapter literally spawns Claude Code subprocess (same pattern as Maestro)
- Claude Code gives us MCP servers, skills, CLAUDE.md, web search — full toolkit
- OpenClaw adds a second unknown runtime on top of a new orchestration platform — too many unknowns at once
- Can evaluate OpenClaw later once orchestration is proven

### Why This Agent Order

Opal first because organizational memory should capture everything from day one. CEO second because nothing moves without prioritization. Research third because it feeds everything downstream. Dev fourth because you need products before sales. The rest follow the natural business pipeline.

### Naming

Agent names TBD. Requirements:

- Reflect the role or vibe
- Consistent theme across all 8
- Not generic baby names
- Will finalize after roles are locked and tested

## Relationship to Maestro (GoBot)

This is a **separate project**, not an extension of Maestro.

- **Maestro** = personal AI assistant via Telegram (reactive, message-driven)
- **This** = autonomous business operation via Paperclip (proactive, heartbeat-driven)

They share DNA (Claude Code, similar harness thinking) but serve different purposes. Maestro stays as your personal agent. This becomes the business machine.

Potential future integration: Maestro could be a communication layer *into* Paperclip (send a Telegram message → creates an issue for the CEO agent). But that's Phase 7+ thinking.

## Tech Stack


| Layer              | Technology                                                    |
| ------------------ | ------------------------------------------------------------- |
| Orchestration      | Paperclip (this fork)                                         |
| Agent Runtime      | Claude Code CLI (`claude_local` adapter)                      |
| Database           | Embedded Postgres (dev) → Supabase (prod)/look at Covex first |
| UI                 | Paperclip Board (React + Vite)                                |
| Agent Instructions | Markdown files in `config/agents/`                            |
| Package Manager    | pnpm (Paperclip convention)                                   |
| Language           | TypeScript throughout                                         |


## Open Questions

1. **What's the first product?** Research agent's first real task — but we should have a domain/niche in mind to seed it.
2. **Budget per agent?** Need to estimate token costs per heartbeat cycle × frequency. Finance analysis needed.
3. **Heartbeat frequency per agent?** Research might run hourly, CEO every 30min, Dev only when assigned work. Need to tune.
4. **Human approval scope?** What decisions can agents make autonomously vs. what needs Doug's sign-off?
5. **Opal's memory backend?** Paperclip has basic knowledge base planned. Do we also wire in recall/Hindsight, or keep it self-contained? Seperate Hindsight Instance. 
6. **Agent model selection?** CEO/Research probably need Opus. Dev might work on Sonnet. QC could be Haiku for cost efficiency. Need to test.

## Getting Started

```bash
cd /Users/aialchemy/projects/business/paperclip
pnpm install
pnpm dev
# Dashboard at http://localhost:3100
```

Then: Create company → Create first agent (Opal) → Test heartbeat → Iterate.