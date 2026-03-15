# The 21-Agent Demo: An AI Company Builds a Product

**Date:** 2026-03-15
**Author:** agentsmith
**Status:** Draft

---

## North Star

**Demo goal:** Set up a Paperclip company with 1 CTO, 4 managers, and 16 engineers. Give the CTO a product spec. Watch the entire company self-organize, delegate, build, review, and ship a working product — while you manage everything from Slack and Jira.

```
You (Board Operator)
  │
  ├── Slack: approve hires, watch progress, chat with CTO, react to tasks
  ├── Jira: full project board mirroring all Paperclip tasks
  ├── GitHub: PRs opened by engineers, reviewed by peers, merged
  └── Paperclip Dashboard: org chart, budgets, live agent work, approvals
         │
    ┌────┴────────────────────────────────────────────────┐
    │                      CTO                             │
    │   Breaks spec into goals, hires managers, oversees   │
    │                                                      │
    ├── Frontend Manager                                   │
    │   ├── UI Engineer 1                                  │
    │   ├── UI Engineer 2                                  │
    │   ├── UI Engineer 3                                  │
    │   └── UI Engineer 4                                  │
    │                                                      │
    ├── Backend Manager                                    │
    │   ├── API Engineer 1                                 │
    │   ├── API Engineer 2                                 │
    │   ├── API Engineer 3                                 │
    │   └── API Engineer 4                                 │
    │                                                      │
    ├── Infrastructure Manager                             │
    │   ├── DevOps Engineer 1                              │
    │   ├── DevOps Engineer 2                              │
    │   ├── DevOps Engineer 3                              │
    │   └── DevOps Engineer 4                              │
    │                                                      │
    └── QA Manager                                         │
        ├── QA Engineer 1                                  │
        ├── QA Engineer 2                                  │
        ├── QA Engineer 3                                  │
        └── QA Engineer 4                                  │
    └──────────────────────────────────────────────────────┘

21 agents. One product. You just approve and watch.
```

### What the Demo Proves

| Capability | How the demo shows it |
|------------|----------------------|
| Org hierarchy & delegation | CTO → Managers → Engineers, tasks flow down |
| Bidirectional Slack sync | You approve hires, react to tasks, get status — all from Slack |
| Bidirectional Jira sync | Every task appears in Jira, status flows both ways |
| GitHub PR workflow | Engineers open PRs, peers review, CI runs, you see it all |
| Budget controls | 21 agents with cost guardrails, no runaway spend |
| Approvals | CTO proposes strategy/hires, you approve from Slack |
| Parallel execution | 16 engineers working simultaneously on different tasks |
| Workspace isolation | Each engineer has their own git worktree, no conflicts |
| Goal alignment | Every task traces back to company mission |
| Activity feed | Unified "what happened" across all tools |

### Demo Product Ideas

Something visual, shippable, and impressive:

- **A SaaS dashboard** — auth, API, real-time charts, responsive UI
- **A developer tool CLI + web UI** — shows both backend and frontend work
- **A simple e-commerce site** — catalog, cart, checkout, admin panel
- **A project management app** (meta!) — Paperclip builds a mini Paperclip

---

## What Already Exists (Don't Rebuild)

### Paperclip Core (Ready)
- Full issue CRUD with 7 statuses, 4 priorities, comments, labels, attachments, documents
- Org chart with reports-to hierarchy — perfect for CTO → Manager → Engineer
- Goal hierarchy: Company → Team → Agent → Task
- Budget enforcement with auto-pause at limit
- Approval gates for hires and strategy
- Heartbeat scheduling with agent wakeups
- Workspace support with git worktrees
- 7 built-in adapters (Claude, Codex, Cursor, OpenClaw, Gemini, OpenCode, Pi)

### Plugin System (Ready for Connectors)
- Plugin event bus fires: `issue.created`, `issue.updated`, `issue.comment.created`
- Plugin webhooks: `POST /api/plugins/:pluginKey/webhooks/:webhookKey`
- Plugin SDK with full issue CRUD, agent invocation, entity tracking, scoped state
- Plugin secrets for API keys
- Plugin entities for external object tracking (`"github-pr"`, `"jira-issue"`)

### OpenClaw Gateway Adapter (Ready — Nice to Have)
- `@paperclipai/adapter-openclaw-gateway` at `packages/adapters/openclaw-gateway/`
- WebSocket protocol, device auth, session routing per issue
- Streaming events back to Paperclip for transcript parsing
- Always-on agent availability (between heartbeats)

---

## Part 1: Connector Architecture (Build Once, Connect Many)

### How a Connector Plugin Works

```
┌─────────────────────────────────────────────────────────┐
│                   Connector Plugin                       │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ Event Handler │    │ Webhook      │    │ Mapping   │ │
│  │ (outbound)   │    │ Handler      │    │ Store     │ │
│  │              │    │ (inbound)    │    │           │ │
│  │ issue.created│    │ POST /wh/... │    │ PC ID ↔   │ │
│  │ issue.updated│    │ → parse      │    │ Ext ID    │ │
│  │ comment.added│    │ → call PC API│    │           │ │
│  └──────┬───────┘    └──────┬───────┘    └─────┬─────┘ │
│         │                   │                   │       │
│         ▼                   ▼                   ▼       │
│  Push to external    Write to Paperclip   Echo check   │
│  (Slack/Jira/GitHub)  (issue API)         (skip if     │
│                                            own change) │
└─────────────────────────────────────────────────────────┘
```

### Shared Pattern (Convention, Not a Package)

```ts
// OUTBOUND: Paperclip → External Tool (plugin event handler)
async function onIssueCreated(event: PluginEvent): Promise<void> {
  const externalId = await externalApi.createItem(mapFromPaperclip(event));
  await saveMapping(event.entityId, externalId);
}

async function onIssueUpdated(event: PluginEvent): Promise<void> {
  if (isEcho(event)) return;
  const mapping = await getMapping(event.entityId);
  if (!mapping) return;
  await externalApi.updateItem(mapping.externalId, mapFromPaperclip(event));
}

// INBOUND: External Tool → Paperclip (webhook handler)
async function onWebhook(delivery: WebhookDelivery): Promise<void> {
  const parsed = parseExternalEvent(delivery.payload);
  markAsEcho(parsed.correlationId);
  switch (parsed.action) {
    case "create":
      const issue = await ctx.issues.create(mapToPaperclip(parsed));
      await saveMapping(issue.id, parsed.externalId);
      break;
    case "update_status":
      const mapping = await getMapping(parsed.externalId, "external");
      await ctx.issues.update(mapping.paperclipId, { status: parsed.status });
      break;
    case "comment":
      const m = await getMapping(parsed.externalId, "external");
      await ctx.issues.addComment(m.paperclipId, parsed.body);
      break;
  }
}

// ECHO PREVENTION: don't re-sync our own changes
const recentOwnChanges = new Map<string, number>();
function markAsEcho(id: string) {
  recentOwnChanges.set(id, Date.now());
  setTimeout(() => recentOwnChanges.delete(id), 60_000);
}
function isEcho(event: PluginEvent): boolean {
  return recentOwnChanges.has(event.eventId);
}
```

---

## Part 2: Connectors

### 2.1 Slack Connector

#### Slack → Paperclip (Inbound)

| Trigger | SDK Call |
|---------|---------|
| `/paperclip create "fix auth bug"` | `ctx.issues.create({ companyId, title: "fix auth bug" })` |
| `/paperclip create` (no args) | Open Slack modal → `ctx.issues.create(...)` with all fields |
| Reply in synced thread | `ctx.issues.addComment(issueId, body)` |
| ✅ reaction on issue message | `ctx.issues.update(issueId, { status: "done" })` |
| 🚀 reaction | `ctx.issues.update(issueId, { status: "in_progress" })` |
| 🔴 reaction | `ctx.issues.update(issueId, { status: "blocked" })` |
| `/paperclip status` | `ctx.issues.list({ companyId })` → respond ephemerally |
| `/paperclip approve [id]` | `ctx.approvals.resolve(...)` |
| Click "Approve" / "Reject" button | `ctx.approvals.resolve(...)` |

#### Paperclip → Slack (Outbound)

| Plugin Event | Slack Action |
|-------------|-------------|
| `issue.created` | Post Block Kit message with title, priority, assignee, action buttons |
| `issue.updated` (status) | Update existing message, change status badge |
| `issue.updated` (assignee) | Update message, notify new assignee |
| `issue.comment.created` | Post as thread reply on the issue message |
| `approval.requested` | Post approval card with Approve/Reject buttons |
| `approval.resolved` | Update approval card with result |

#### Details

- **Thread-per-issue model:** Each Paperclip issue = one Slack message + its thread
- **Channel mapping:** Configurable per project (e.g. Project "Frontend" → #frontend-tasks)
- **Block Kit messages:** Rich formatting with status badges, priority indicators, action buttons
- **Auth:** `ctx.secrets.resolve("SLACK_BOT_TOKEN")` / `ctx.secrets.resolve("SLACK_SIGNING_SECRET")`

#### Demo Role

You manage the entire 21-agent company from Slack:
- CTO proposes hiring a Frontend Manager → you get approval card → click Approve
- Tasks stream into project channels as they're created
- React ✅ to mark tasks done, 🔴 to flag blockers
- `/paperclip status` shows which agents are working on what

### 2.2 Jira Connector

#### Jira ↔ Paperclip (Bidirectional)

| Jira | Paperclip | Direction |
|------|-----------|-----------|
| Issue | Issue | Both |
| Status (workflow transitions) | Issue status | Both |
| Priority | Issue priority | Both |
| Assignee | Assignee | Jira → PC |
| Comments | Issue comments | Both |
| Labels | Labels | Both |
| Sprint/Epic | Project/Parent issue | Jira → PC |

#### Details

- **Jira Webhooks** for real-time inbound
- **Jira REST API v3** for outbound
- **Status mapping:** Configurable (Jira workflows are custom)
- **Entity tracking:** `ctx.entities.upsert({ entityType: "jira-issue", externalId: "DEMO-123" })`
- **Project mapping:** One Jira project ↔ one Paperclip project

#### Demo Role

Full Jira board shows all 21 agents' work:
- CTO creates high-level epics → appear in Jira
- Managers break into tasks → appear as Jira issues under epics
- Engineers update status → Jira board updates in real-time
- External team members can comment in Jira → agents see it in Paperclip

### 2.3 GitHub Connector

#### The Core Flow

```
Engineer agent creates branch + opens PR
       ↓
GitHub webhook → connector plugin
       ↓
Plugin creates review task, assigns to peer engineer or QA
       ↓
Reviewer agent wakes, reviews PR, posts comments
       ↓
If changes needed: original engineer gets woken
  ctx.agents.invoke(agentId, companyId, {
    prompt: "Address review comments on PR #42",
    reason: "github-pr-review"
  })
       ↓
Engineer pushes fix, reviewer approves, PR merges
       ↓
Plugin updates task status → done
```

#### GitHub → Paperclip (Inbound)

| GitHub Event | SDK Call |
|-------------|---------|
| `pull_request.opened` | `ctx.issues.create({ title: "Review PR #N: ..." })` |
| `pull_request.closed` (merged) | `ctx.issues.update(issueId, { status: "done" })` |
| `pull_request_review_comment.created` | `ctx.issues.addComment(issueId, body)` |
| `issue_comment.created` with `@paperclip` | `ctx.agents.invoke(agentId, companyId, { prompt })` |
| `check_run.completed` (failure) | `ctx.issues.addComment(issueId, "CI failed: ...")` |

#### Paperclip → GitHub (Outbound)

| Plugin Event | GitHub Action |
|-------------|-------------|
| `issue.comment.created` (by reviewer agent) | Post as PR review comment |
| `issue.updated` (status → done) | Approve PR |
| `issue.updated` (status → blocked) | Request changes |

#### Details

- **Entity tracking:** `ctx.entities.upsert({ entityType: "github-pr", externalId: "owner/repo#42" })`
- **Agent routing:** Configurable rules (repo/path → agent)
- **Workspace awareness:** `ctx.projects.getPrimaryWorkspace()` for agent work location
- **Auth:** `ctx.secrets.resolve("GITHUB_TOKEN")`

#### Demo Role

16 engineers opening PRs, reviewing each other's code:
- Engineer opens PR → QA agent auto-assigned as reviewer
- QA posts review comments → Engineer fixes → QA approves
- CI failures trigger agent wakeup to investigate
- All PR activity visible in Paperclip and Slack

### 2.4 Future Connectors (Community)

With three proven patterns (slash commands, webhooks, agent invocation), community can add:
- **Linear** — Similar to Jira, cleaner API
- **Notion** — Polling-based, database ↔ project mapping
- **Discord** — Similar to Slack
- **GitLab** — Similar to GitHub

---

## Part 3: OpenClaw Integration (Nice to Have)

**If we get to this, it's the cherry on top. If not, the demo works fine with heartbeat-based agents.**

### What OpenClaw Adds

| Without OpenClaw | With OpenClaw |
|-----------------|---------------|
| Agents sleep between heartbeats | Agents always reachable |
| Interact via task comments | Chat with agents in real-time |
| Dashboard only | Chat from Slack DM, WhatsApp, Telegram |
| Pull-based (check inbox) | Push-based (instant response) |

### How It Works

1. Configure agents with `adapter_type: "openclaw_gateway"` instead of `"claude-local"`
2. OpenClaw runs the agent's session — always on
3. OpenClaw multi-agent routing maps Slack DMs → the right Paperclip agent
4. Agent has full Paperclip context (tasks, role, goals, budget)
5. You can DM the CTO: "What's the status?" and get an instant answer

### What We'd Build

- **Layer 1:** Configure OpenClaw gateway bindings for all 21 agents
- **Layer 2:** Paperclip context injection into OpenClaw agent sessions
- **Layer 3:** Dashboard chat panel using `ctx.agents.sessions` API
- **Layer 4:** "Agent not responding" escalation to Slack

### Demo Enhancement

With OpenClaw: you DM the CTO on Slack, have a real-time conversation about progress, ask them to reprioritize, and watch tasks reorganize in Jira — all without opening the Paperclip dashboard.

---

## Part 4: The Demo Execution Plan

### Phase 0: Prerequisites (Week 0)

| Task | Details |
|------|---------|
| Paperclip running locally | `pnpm dev`, database seeded |
| Slack workspace | Create Slack app with slash commands, events, interactive components |
| Jira instance | Atlassian Cloud free tier, create project "DEMO" |
| GitHub repo | Create demo product repo, configure webhooks |
| API keys | Claude API key (or other LLM provider) for all agents |
| Budget planning | 21 agents × estimated tokens per task = total budget needed |

### Phase 1: Slack Connector (Weeks 1–2)

| Week | Goal |
|------|------|
| 1 | Scaffold Slack connector plugin |
| 1 | Outbound: issue.created/updated/comment.created → Slack messages |
| 1 | Mapping: issue ↔ thread-ts via `ctx.state` |
| 1 | Echo prevention |
| 2 | Inbound: slash commands, reactions, thread replies |
| 2 | Approval flow: cards with Approve/Reject buttons |
| 2 | Test with 2–3 agents before scaling to 21 |

### Phase 2: Jira Connector (Weeks 3–4)

| Week | Goal |
|------|------|
| 3 | Scaffold Jira connector plugin |
| 3 | Bidirectional issue sync via webhooks + REST API |
| 3 | Status/priority mapping configuration |
| 4 | Comment sync, label sync |
| 4 | Test: create task in Paperclip → appears in Jira → update in Jira → Paperclip updates |

### Phase 3: GitHub Connector (Weeks 5–6)

| Week | Goal |
|------|------|
| 5 | Scaffold GitHub connector plugin |
| 5 | PR opened → create review issue → assign agent |
| 5 | PR comment → `ctx.agents.invoke()` |
| 6 | Agent output → PR review comments |
| 6 | Agent routing rules (repo/path → agent) |
| 6 | Test: full PR lifecycle with 2 agents |

### Phase 4: Build the Company (Week 7)

| Task | Details |
|------|---------|
| Create company | "Demo Co" with mission and goals |
| Create CTO agent | Adapter: claude-local, role: CTO, reports to board |
| Create 4 manager agents | Frontend, Backend, Infra, QA — each reports to CTO |
| Create 16 engineer agents | 4 per manager, each with specific capabilities |
| Configure workspaces | Git worktree strategy for parallel work |
| Configure budgets | Per-agent limits, company total limit |
| Set channel mappings | Slack channels per project, Jira project mapping |
| Write product spec | The spec that the CTO will receive as the first task |
| Test delegation chain | CTO → Manager → Engineer with 1 simple task |

#### Org Chart Configuration

```ts
// CTO
{ name: "CTO", title: "Chief Technology Officer", role: "executive",
  adapter: "claude-local", reportsTo: null,
  capabilities: "Strategic planning, architecture decisions, team management, code review" }

// Managers
{ name: "Frontend Lead", title: "Frontend Engineering Manager", role: "manager",
  adapter: "claude-local", reportsTo: "CTO",
  capabilities: "React, TypeScript, UI/UX, component architecture, frontend performance" }

{ name: "Backend Lead", title: "Backend Engineering Manager", role: "manager",
  adapter: "claude-local", reportsTo: "CTO",
  capabilities: "Node.js, PostgreSQL, API design, system architecture, data modeling" }

{ name: "Infra Lead", title: "Infrastructure Manager", role: "manager",
  adapter: "claude-local", reportsTo: "CTO",
  capabilities: "Docker, CI/CD, deployment, monitoring, security, cloud infrastructure" }

{ name: "QA Lead", title: "QA Manager", role: "manager",
  adapter: "claude-local", reportsTo: "CTO",
  capabilities: "Test strategy, E2E testing, integration testing, quality standards" }

// Engineers (4 per manager, each with specialization)
// Frontend: component dev, styling, state management, accessibility
// Backend: API routes, database, auth, integrations
// Infra: Docker, CI, deployment scripts, monitoring
// QA: unit tests, E2E tests, load tests, security tests
```

#### Budget Strategy

```ts
{
  company: { monthlyBudgetCents: 50000 }, // $500 total demo budget
  agents: {
    cto:       { monthlyBudgetCents: 5000 },  // $50 — planning & coordination
    managers:  { monthlyBudgetCents: 3000 },  // $30 each × 4 = $120
    engineers: { monthlyBudgetCents: 1500 },  // $15 each × 16 = $240
    // Reserve: $90 for retries, escalations, reviews
  }
}
```

### Phase 5: Run the Demo (Weeks 8–9)

| Step | What happens |
|------|-------------|
| 1 | Give CTO the product spec as a company goal |
| 2 | CTO breaks spec into team goals, creates manager tasks |
| 3 | You approve CTO's hiring plan from Slack (if managers aren't pre-created) |
| 4 | Managers break team goals into engineering tasks |
| 5 | Engineers pick up tasks, create branches, write code |
| 6 | Engineers open PRs → GitHub connector creates review tasks |
| 7 | QA engineers review PRs, post comments |
| 8 | Engineers address review feedback (GitHub comment → agent invoke) |
| 9 | PRs merge, Jira updates, Slack celebrates |
| 10 | Infra team deploys, QA runs final tests |
| 11 | Product is live. You managed it all from Slack. |

**Your role during the demo:**
- Approve strategic decisions (Slack buttons)
- Unblock agents when they're stuck (Slack thread replies)
- Monitor budget burn (Paperclip dashboard)
- Override priorities if needed (Jira or Slack)

### Phase 6: Polish & Record (Weeks 10–11)

| Task | Details |
|------|---------|
| Fix bugs found during demo | Connector issues, race conditions, edge cases |
| Record screen captures | Slack interactions, Jira board, GitHub PRs, dashboard |
| Write up results | Cost analysis, time to completion, quality assessment |
| Create demo video/blog post | Showcase the 21-agent company in action |

### Phase 7: Contribute Upstream (Week 12)

| Task | Details |
|------|---------|
| Clean up connector code | Per Plugin Authoring Guide |
| Open PRs | Each connector as separate plugin package |
| Write docs | Setup guides, configuration, troubleshooting |
| Community feedback | Iterate based on reviews |

---

## Part 5: OpenClaw Integration (Nice to Have — Post-Demo)

If the demo works well with heartbeat-based agents and we want to level up:

### What to Add

1. **Switch agents to OpenClaw adapter** — `adapter_type: "openclaw_gateway"`
2. **Configure multi-agent routing** — Slack DMs → specific agents
3. **Dashboard chat panel** — Talk to any agent from the Paperclip UI
4. **"Not responding" escalation** — Alert Slack if an agent goes down

### Why It's Worth It for Managed Service

- "Chat with your CTO" is the killer demo for managed Paperclip
- Always-on agents feel more like real employees
- OpenClaw handles the hard messaging infrastructure
- Paperclip handles the hard governance infrastructure
- Together: a complete AI company platform

---

## Part 6: Managed Service (Long-Long Term)

### What Managed Paperclip Looks Like

- **Multi-tenant hosting:** One instance, many companies
- **Connector marketplace:** Slack/Jira/GitHub — just OAuth and go
- **Optional hosted OpenClaw:** Always-on agents, chat from any platform
- **Billing:** Per-agent, per-connector, or flat monthly
- **Onboarding:** Wizard → connect tools → first agent running in 5 minutes

### Revenue Model

- **Free:** 1 company, 3 agents, 1 connector
- **Pro ($99/mo):** Unlimited agents, all connectors, priority sync
- **Enterprise:** SSO, audit logs, dedicated instance, SLA, OpenClaw hosting

---

## Success Criteria

### The Demo Works When...

- [ ] You give the CTO a product spec and a working product comes out
- [ ] All 21 agents coordinate without manual intervention (beyond approvals)
- [ ] Every task flows through Slack, Jira, and GitHub
- [ ] Budget is respected — no agent exceeds its limit
- [ ] The whole company spends less than $500 to build the product
- [ ] You managed the entire process from Slack (never needed the terminal)

### Connectors Work When...

- [ ] Create task from Slack → appears in Jira and dashboard within 5 seconds
- [ ] Update status in Jira → Slack message updates, Paperclip updates
- [ ] PR opened → review task auto-created → agent reviews
- [ ] `@paperclip fix this` in PR comment → agent pushes fix
- [ ] No echo loops — changes don't bounce between tools
- [ ] Add a fourth connector in under 2 days

### OpenClaw Integration Works When... (Nice to Have)

- [ ] DM an agent on Slack → instant response with Paperclip context
- [ ] Chat with CTO from dashboard → real-time conversation
- [ ] Agent not responding → Slack alert within 60 seconds

---

## Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Source of truth | Paperclip always | Hub-and-spoke; Slack/Jira/GitHub are spokes |
| Sync infrastructure | Plugin event bus + webhooks | Already built, company-scoped |
| Connector packaging | Paperclip plugins (npm) | Plugin spec, installable, no core changes |
| ID mapping | Plugin entities + state | `ctx.entities` for objects, `ctx.state` for metadata |
| Echo prevention | In-memory TTL map | Simple, fast, no database overhead |
| Agent adapter | claude-local (demo), openclaw_gateway (stretch) | Start simple, upgrade later |
| Workspace isolation | Git worktrees | 16 engineers need parallel work without conflicts |
| Demo product | TBD — suggest SaaS dashboard | Visual, multi-layer (FE + BE + Infra + QA) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 21 agents = high cost | Conservative budgets, circuit breakers, can scale down to 9 (1+2+6) |
| Workspace conflicts | Git worktree strategy, one branch per engineer |
| Slack rate limits | Queue outbound, batch updates, respect rate headers |
| Agent coordination loops | Task checkout locking prevents double-work |
| Demo product too ambitious | Start with minimal spec, can always add features |
| OpenClaw setup complexity | Mark as nice-to-have, demo works without it |
| Plugin system gaps | Report and fix upstream as we hit them |

---

## Files to Create

### Connector Plugins

```
plugins/
├── connector-slack/
│   ├── plugin.json
│   ├── package.json
│   ├── src/
│   │   ├── worker.ts        # Event handlers + webhook handlers
│   │   ├── slack-api.ts     # Slack API client (Block Kit, slash commands)
│   │   ├── mapping.ts       # PC ID ↔ Slack message ts
│   │   ├── echo.ts          # Echo prevention
│   │   └── status-map.ts    # PC status ↔ Slack display
│   └── README.md
│
├── connector-jira/
│   ├── plugin.json
│   ├── package.json
│   ├── src/
│   │   ├── worker.ts
│   │   ├── jira-api.ts      # Jira REST API v3 client
│   │   ├── mapping.ts       # PC ID ↔ Jira issue key
│   │   ├── echo.ts
│   │   └── status-map.ts    # PC status ↔ Jira transitions
│   └── README.md
│
├── connector-github/
│   ├── plugin.json
│   ├── package.json
│   ├── src/
│   │   ├── worker.ts
│   │   ├── github-api.ts    # GitHub REST/GraphQL
│   │   ├── mapping.ts       # PR ↔ Issue mapping
│   │   ├── echo.ts
│   │   ├── routing.ts       # Agent routing rules
│   │   └── pr-review.ts     # Review flow orchestration
│   └── README.md
│
└── connector-*/              # Future: linear, notion, discord
    └── (same structure)
```

### Demo Setup Scripts

```
demo/
├── setup-company.ts         # Create company, goals, org chart
├── setup-agents.ts          # Create all 21 agents with roles and budgets
├── setup-workspaces.ts      # Configure git worktrees for all engineers
├── setup-connectors.ts      # Link Slack channels, Jira project, GitHub repo
├── product-spec.md          # The product spec given to the CTO
└── README.md                # How to run the demo
```

### No Core Changes Needed

Connectors are plugins. Demo setup uses existing APIs. If the plugin system has gaps, fix upstream separately.
