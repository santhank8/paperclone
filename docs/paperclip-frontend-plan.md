# Paperclip Frontend — Product Plan (Reviewed)

> **Review mode:** SCOPE EXPANSION
> **Review date:** 2026-03-15
> **Decisions locked:** 12

## What We're Building

A standalone, marketable product on top of Paperclip that makes "hire an AI team" feel as simple as signing up for a SaaS product. Not a fork of the existing Paperclip UI — a new product that uses Paperclip as invisible infrastructure.

**Target users:** Non-technical business owners, content creators, agency operators, solopreneurs — people who want AI agents running parts of their business but don't want to touch a terminal.

**One-liner:** "Your AI team, managed for you."

**Cathedral vision:** Shopify for AI workforces. Users pick a vertical, answer brand questions, and get a self-improving autonomous team deployed in 60 seconds. The team runs overnight, sends morning briefings, escalates when it needs help, and gets better with every task.

---

## Architecture (locked)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER TOUCHPOINTS                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Web App  │  │ Mobile   │  │ Telegram/    │  │ Email         │  │
│  │ (Next.js)│  │ (RN/Expo)│  │ Slack/etc    │  │ Digest        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
│       └──────────────┼───────────────┼──────────────────┘          │
│                      ▼               ▼                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    API GATEWAY / BFF                          │  │
│  │  Auth (Clerk/NextAuth) │ Rate Limiting │ Usage Metering      │  │
│  │  Company Router        │ Task Router   │ Billing Events      │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │                                  │
│  ┌───────────────────────────────▼───────────────────────────────┐  │
│  │                 PAPERCLIP SERVER (Railway)                    │  │
│  │  Companies (multi-tenant)  │  Agents  │  Issues  │  Costs    │  │
│  │  Realtime Events (SSE)     │  Runs    │  Comments│  Approvals│  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Postgres (managed via Railway, row-level isolation)    │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────┬───────────────────────────────┘  │
│                                  │ spawns per-company               │
│  ┌───────────────────────────────▼───────────────────────────────┐  │
│  │           PER-COMPANY DOCKER CONTAINERS                      │  │
│  │  ┌───────────────┐  ┌────────────────┐                       │  │
│  │  │ Claude Code   │  │ LLM Proxy      │                       │  │
│  │  │ Agent         │──│ (sidecar)      │──── OpenRouter API    │  │
│  │  │ no API key    │  │ meters usage   │                       │  │
│  │  │ localhost:4000│  │ rate limits    │                       │  │
│  │  └───────────────┘  └────────────────┘                       │  │
│  │  /workspace/company-x/ (isolated mount)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              CONVEX (realtime relay + user layer)            │   │
│  │  User accounts │ Subscriptions │ Skill catalog │ Email      │   │
│  │  Agent status relay (webhooks from Paperclip)                │   │
│  │  Usage events (billing source of truth, append-only)         │   │
│  │  Metrics tables (task_completions, agent_errors, etc.)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Multi-tenancy | Managed, one Paperclip instance | Simplest UX — sign up and go. Company-per-user. |
| Agent isolation | Docker container per company | Real filesystem + network isolation. No trust-based security. |
| Realtime updates | Convex as relay (webhooks) | Zero WS infra. Convex handles persistence + scale. 500ms latency acceptable. |
| API key security | LLM proxy sidecar | Key never enters container env. Single metering point. Rate limiting. |
| Billing model | Base subscription + usage markup | $29-149/mo base + Claude/OpenRouter usage at 1.5-2x. Transparent per-task cost. |
| LLM provider | OpenRouter (multi-model) | Cost control — Haiku for QC, Sonnet for builders, flexible routing. Model fallback. |
| Backend hosting | Railway | Managed Docker + Postgres. Auto-deploy. Known platform. |
| Frontend hosting | Vercel | Next.js native. Auto-deploy. Edge network. |
| Observability | Convex + Vercel Analytics + Sentry | Zero new infra. Custom admin dashboard as protected route. |
| E2E testing | Mock Paperclip adapter + nightly real runs | Fast CI (<60s) + real validation catches drift. |
| Template deployment | Transactional with rollback | All-or-nothing. No partial agent teams. |
| QC bounce cap | 3 bounces → escalate to user | Prevents cost bombs. Human-in-the-loop at the right moment. |

---

## Core Screens (5 total)

### 1. Team Dashboard (home screen)
Your AI team at a glance.

- **Agent cards** — avatar, name, title, status (idle/working/error), what they're working on. Agents have *personality* in their status messages ("Scout here — found 3 trending topics 🔥")
- **Pipeline visualization** — horizontal flow showing work moving through stages. Animated dots/cards.
- **Recent completions** — last 5 deliverables with cost-per-deliverable card ("This blog post cost $0.47. A freelancer charges $150-300.")
- **Cost ticker** — today's spend, this month's spend, projected monthly

No tables. No JSON. No UUIDs visible anywhere.

### 2. New Task (one screen, one input)
"What do you need done?"

- Big text input (max 2000 chars, sanitized) with smart suggestions
- Auto-route to correct pipeline based on input, with disambiguation if ambiguous
- Optional: priority, deadline
- One button: "Assign to Team"
- Empty state for new users: "Deploy your first team" CTA

### 3. Pipeline View (task detail)
Click any task to see its journey.

- **Timeline** — visual progression through each agent. Animated replay available — watch the task flow through the pipeline ("Watch Replay" button, 3-5 day build, demo gold)
- **Deliverables** — rendered as readable content, not raw markdown. Copy/download buttons
- **Cost card** — "$0.47 to produce. A freelancer charges $150-300." (build in MVP)
- **Agent comments** — collapsed by default, expandable
- **Escalation UI** — if bounced 3x: "Your team needs input" with approve/adjust/cancel options

### 4. Team Settings
Configure agents through a form, not markdown files.

- **Agent roster** — name, avatar, role, model, instructions (rich text), budget cap
- **Pipeline builder** — visual drag-and-drop. "On QC PASS → Optimizer. On QC FAIL → Builder."
- **Templates** — one-click deploy pre-built teams. "Content Studio," "Agency Ops," "Skill Factory."
- Template deployment: transactional with rollback. All-or-nothing.

### 5. Costs & Usage
"Am I getting ROI?"

- **Monthly spend chart** — by agent, by task type
- **Per-task cost** — average, trending over time
- **Agent efficiency** — QC pass rate, avg iterations, optimizer win rate
- **Budget alerts** — configurable caps, 80% warnings, cost spike alerts ($5+ single task)

### Admin Dashboard (protected /admin route)
- Company health: red/yellow/green per company
- System metrics: task completion rate, error rate, container health
- Cost anomaly detection: flag 3x daily average spikes
- Usage event audit trail for billing disputes

---

## Pre-Built Templates (launch with 3)

### Content Studio
| Agent | Voice | What it does |
|---|---|---|
| Scout | Enthusiastic researcher | Finds trending topics via X/Reddit/YouTube |
| Writer | Thoughtful craftsperson | Writes video scripts/blog posts from briefs |
| Editor | Exacting perfectionist | Reviews for hooks, pacing, brand voice |
| Repurposer | Efficient multitasker | Turns one piece into tweets/newsletters/shorts |

### Agency Ops
| Agent | Voice | What it does |
|---|---|---|
| Intake | Organized coordinator | Processes client briefs, extracts requirements |
| Strategist | Big-picture thinker | Creates campaign/project plans |
| Creator | Focused executor | Executes deliverables |
| QC | Detail-oriented reviewer | Brand compliance + quality check |
| Client Comms | Professional communicator | Drafts client-facing presentations |

### Skill Factory (our current setup)
| Agent | Voice | What it does |
|---|---|---|
| Research | Data-driven analyst | Finds skill opportunities |
| SkillBuilder | Meticulous engineer | Builds skills from briefs |
| QC | Strict quality gate | Reviews against brief + tests |
| Optimizer | Relentless improver | Iterative A/B improvement |

---

## Security Model

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tenant cross-read | Medium | HIGH | Docker isolation per company |
| Prompt injection via task input | HIGH | Medium | Agent instruction hardening + input sanitization |
| API key extraction | Medium | HIGH | LLM proxy sidecar — key never in container |
| Cost bomb / runaway loop | HIGH | HIGH | 3-bounce cap, per-company daily spend cap, kill switch |
| Abuse (crypto mining via agent) | Low | HIGH | Docker resource limits (CPU/mem/time) |
| Account takeover | Low | HIGH | Clerk/NextAuth with MFA |
| Billing fraud | Medium | Medium | Append-only usage events, per-request audit trail |
| Data retention after deletion | Medium | Medium | GDPR-style cascade deletion on account removal |

---

## Revenue Model

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | 1 agent, 10 tasks/month, community templates |
| Pro | $49/mo + usage | 5 agents, unlimited tasks, all templates, cost dashboard |
| Team | $149/mo + usage | Unlimited agents, priority execution, custom templates, messaging integrations |
| Enterprise | Custom | Dedicated instance, SLA, custom agent development |

Usage: Claude/OpenRouter API costs passed through at 1.5-2x markup. Per-task cost shown transparently.

---

## MVP Scope

**Phase 1: Core product (4-6 weeks)**
- [ ] Team Dashboard with agent cards + personality status messages
- [ ] New Task flow (text input → Paperclip issue, with sanitization + routing)
- [ ] Pipeline View with timeline + deliverable rendering
- [ ] Pipeline replay animation (watch task flow through agents)
- [ ] Cost-per-deliverable card ("$0.47 vs $300 freelancer")
- [ ] One pre-built template (Skill Factory)
- [ ] Auth + billing via Convex + Stripe
- [ ] Paperclip on Railway (Docker + managed Postgres)
- [ ] Per-company Docker containers with LLM proxy sidecar
- [ ] Convex realtime relay (webhooks from Paperclip)
- [ ] Admin dashboard (/admin, company health)
- [ ] Mock Paperclip adapter for testing
- [ ] Sentry error tracking

**Phase 2: Polish + templates (2-3 weeks)**
- [ ] Content Studio template
- [ ] Agency Ops template
- [ ] Team Settings with visual pipeline builder
- [ ] Onboarding wizard ("What does your business do?")
- [ ] Costs & Usage dashboard with budget alerts
- [ ] Morning briefing (daily email/Telegram/Slack summary)
- [ ] Share card (OG image generation for social sharing)
- [ ] Multi-platform notifications abstraction layer
- [ ] Notification channel support: Slack, Telegram, Discord, email

**Phase 3: Growth (ongoing)**
- [ ] Template marketplace (users share/sell agent configs, 30% take)
- [ ] Mobile app (React Native/Expo)
- [ ] CEO-via-Telegram (text commands → pipeline execution)
- [ ] Plugin system (connect agents to Shopify, HubSpot, etc.)
- [ ] Self-hosted mode documentation
- [ ] API for power users
- [ ] White-label for agencies

---

## Rollout Plan

```
Phase 0 (now):      Landing page + waitlist → validate demand
Phase 1 (week 1-2): Internal dogfood — Skill Factory on productized stack
Phase 2 (week 3-4): Private beta — 5-10 invited users, Content Studio
Phase 3 (week 5-6): Public beta — open signups, Pro tier billing active
Phase 4 (week 7+):  GA — Agency Ops, mobile, Telegram integration
```

---

## Competitive Landscape

| Product | What they do | Why we're different |
|---|---|---|
| Relevance AI | Agent builder with UI | No pipeline handoffs, no QC loop, no learnings |
| CrewAI | Multi-agent framework | Code-only, no UI, no persistence, no cost tracking |
| AutoGen | Microsoft's agent framework | Research-focused, no product UI, complex setup |
| Paperclip (raw) | The orchestration engine | Developer-facing, intimidating, no templates |
| Simon Scrapes "Agentic OS" | Organized skill folders | Manual, human-in-loop, no real autonomy |
| **Us** | **Product on Paperclip** | **Consumer-grade UI, autonomous pipelines, pre-built teams, learnings loop, managed hosting** |

---

## 12-Month Trajectory

```
NOW (Mar 2026)           6 MONTHS (Sep 2026)         12 MONTHS (Mar 2027)
──────────────────       ──────────────────────       ──────────────────────
5 agents, our use        500+ paying companies        5000+ companies
1 template               10 templates                 50+ templates (marketplace)
Web only                 Web + mobile + Telegram      White-label available
$0 revenue               $15K MRR                     $100K MRR
Manual pipeline fixes    Self-healing pipelines       Community-built agents
```

---

## Open Questions (remaining)

1. **Auth provider** — Clerk vs NextAuth vs Convex built-in? Affects MFA, social login, team invites.
2. **Task routing model** — Simple keyword matching or LLM-powered intent classification? LLM is better but adds latency + cost to every task creation.
3. **Agent instruction storage** — Filesystem (current) vs database? DB is needed for multi-tenant where users can't access the server's filesystem.
4. **Paperclip version pinning** — Pin to a specific release or track main? Need upgrade strategy.
5. **Notification abstraction** — Build our own adapter layer or use a service like Novu/Knock?

---

## NOT in Scope (explicitly deferred)

- Self-hosted deployment tooling (Phase 3)
- White-label / reseller program (Phase 3)
- Custom model fine-tuning per company (future)
- Video/image generation agents (future — different infra needs)
- Marketplace payment processing (Phase 3)
- SOC 2 / compliance certification (when enterprise customers demand it)
- Internationalization / i18n (future)

---

## Technical Debt Register

| Debt | Severity | When to pay |
|---|---|---|
| Docker-in-Docker on Railway | Medium | At >20 concurrent containers → Fly.io Machines |
| Convex as metrics store | Low | At >10K companies → dedicated OLAP |
| Shared API key rate limits | Medium | At heavy multi-tenant load → per-company key rotation |
| Mock adapter maintenance | Low | Pin Paperclip version, update mock on upgrade |
