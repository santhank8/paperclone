# Paperclip — Vision & Enhancement Design
> Created: 2026-03-23 | Status: APPROVED | Author: Claude (QA/Planner)
> Executing agent: read this entire document before touching any file.

---

## 1. Vision

Paperclip is the **go-to app to build, launch, and grow products using AI agent employees**.
Users set a goal. AI agents build the product, ship it, market it, handle support, and track revenue — autonomously, with the user approving only the decisions that matter.

**Primary user:** Indie hackers, solopreneurs, small startup founders who want AI leverage without managing infrastructure or prompts. They want to make money — in cash or crypto — and check progress from their phone.

**The core promise:** Set a mission. Agents work. You approve the big calls. Revenue grows.

---

## 2. What Already Exists — DO NOT REBUILD

Executing agents: read this section first. Building any of the following is wasted work.

| System | Files | Notes |
|--------|-------|-------|
| Auth (better-auth) | `server/src/auth/better-auth.ts` | Full sign-in/sign-up/session |
| AI Provider configs | `ui/src/components/settings/aiProviderConfigs.ts` | OpenAI, Anthropic, Alibaba, Groq, xAI, local |
| Integration catalog | `ui/src/components/settings/integrationConfigs.ts` | Stripe, Telegram, Slack, Resend, GitHub, Sentry, Plausible, Uptime Kuma |
| Integration verify endpoints | `server/src/routes/integrations.ts` | All providers have test endpoints |
| Stripe webhook → revenue_events | `server/src/routes/webhooks.ts` | Auto-ingest, already live |
| Telegram notifier | `server/src/services/telegram-notifier.ts` | Text-only currently |
| Slack notifier | `server/src/services/slack-notifier.ts` | Text-only currently |
| Approvals table | `packages/db/src/schema/approvals.ts` | status, payload, agent, timestamps |
| Notification log | `packages/db/src/schema/notification_log.ts` | channel, recipient, type, status |
| Goals tree (hierarchical) | `packages/db/src/schema/goals.ts` | parentId, ownerAgentId |
| Integration awareness | `packages/db/src/schema/integrationRecommendations.ts` | blocks, catalog, recommendations |
| IntegrationBlockBanner/Modal | `ui/src/components/IntegrationBlockBanner.tsx` | Real-time, Phase 6 |
| Onboarding wizard | `ui/src/components/OnboardingWizard.tsx` | 4-step: company+goal → adapter → CEO → task |
| Activity log | `packages/db/src/schema/activity_log.ts` | Full audit trail in DB |
| Cost tracking | `server/src/services/pricing.ts`, `costs.ts` | Per-agent token cost |
| Company secrets | `packages/db/src/schema/company_secrets.ts` | Encrypted, secret_ref pattern |
| Multi-company | `packages/db/src/schema/companies.ts` | One instance, many companies |
| Adapter system | `packages/adapters/` | claude-local, codex-local, openclaw, process, http |
| WebSocket real-time | `server/src/services/live-events.ts` | Existing ws infrastructure |
| Radix UI + shadcn primitives | `ui/src/components/ui/` | Button, Dialog, Popover, Tabs, Input, etc. |
| @mdxeditor/editor | Already in UI package.json | Rich text editor, ready to use |
| @dnd-kit | Already in UI package.json | Drag and drop |
| react-router-dom v7 | Already in UI package.json | Routing |
| @tanstack/react-query v5 | Already in UI package.json | Data fetching |
| Drizzle ORM + Postgres | `packages/db/` | Schema, migrations, seed |
| Pino logging | `server/src/middleware/logger.ts` | Structured logging |
| Zod validation | Throughout server | Schema validation |

---

## 3. OSS Stack Decisions

Every package chosen here solves a specific gap. No speculative additions.

### Infrastructure

| Gap | Package | Version | License | Rationale |
|-----|---------|---------|---------|-----------|
| Auto-approve timers, digest scheduling, budget watcher | `bullmq` + `ioredis` | bullmq@5, ioredis@5 | MIT | Delayed jobs + retries. Redis added as single new docker-compose service. |
| Mission state machine | `xstate` | v5 | MIT | Prevents illegal state transitions. Testable. Visual debugging. |
| Crypto payment — Web3/NFT/AI agent cards | `@crossmint/sdk` | latest | MIT | 40K+ devs, 40+ chains, **AI agent virtual cards** (agents can pay autonomously), Adidas/Red Bull clients. Best for Web3 products. |
| Crypto payment — simple fiat crypto | Coinbase Commerce REST API | — | — | No SDK needed. Webhook mirrors Stripe pattern exactly. Free. Most trusted brand. |
| Crypto payment — USDC/subscriptions | MoonPay Commerce REST API | — | — | Pre-built checkout widget. Best for digital goods and subscription models. |
| Social media + workflow automation | `activepieces` | self-hosted | MIT | 330+ connectors (Twitter/X, LinkedIn, Instagram, etc.). YC-backed. Simpler than n8n for social. Programmatic trigger API for agents. |
| Web Push notifications (iOS 16.4+) | `web-push` | ^3.6 | MIT | VAPID-based. Works on iOS Safari without native app. |
| PWA + offline caching | `vite-plugin-pwa` | ^0.21 | MIT | Makes app installable on iPhone home screen. Offline approval queue cache. |
| Swipe gestures (approve/reject) | `@use-gesture/react` | ^10 | MIT | Touch + mouse inertia. Used by Framer Motion. 8M downloads/week. |

### Notification Delivery (extend existing, don't rebuild)

| Gap | Package | Rationale |
|-----|---------|-----------|
| Telegram inline approve/reject buttons | `node-telegram-bot-api` | Extend existing telegram-notifier.ts. `reply_markup.inline_keyboard` for [Approve][Reject] buttons. Callback handler calls existing PATCH /api/approvals/:id. |
| Email delivery | `resend` | Already in integration catalog as verified integration. Add delivery adapter. |
| React Email templates | `@react-email/components` | Responsive email components in React. Renders to HTML for Resend. |
| Slack action blocks | Extend existing `slack-notifier.ts` | Slack Block Kit interactive buttons. No new package. |

### Frontend Polish

| Gap | Package | Rationale |
|-----|---------|-----------|
| Knowledge doc editor | `@mdxeditor/editor` | Already installed. Zero new dependency. |
| Analytics reading | PostHog JS (`posthog-js`) | Open source, self-hostable. Agents can read events/funnels via API. |

---

## 4. Architecture — Full Updated Diagram

```
YOU (Board)
  Mobile Safari (PWA installed) / Desktop Browser
  ┌──────────────────────────────────────────────────────────────┐
  │  Bottom Nav: Dashboard · Tasks · Agents · Approvals●  · Settings │
  └──────────────────────────┬───────────────────────────────────┘
                             │ approve / configure / monitor
  ┌──────────────────────────▼───────────────────────────────────┐
  │              PAPERCLIP SERVER                                │
  │                                                              │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │  Mission Engine (NEW)                                   │ │
  │  │  XState machine: draft→active→paused→completed/failed   │ │
  │  │  Budget enforcer: checks cost_events before agent wake  │ │
  │  │  Risk tier evaluator: green/yellow/red per action_type  │ │
  │  └────────────────────────┬────────────────────────────────┘ │
  │                           │                                   │
  │  ┌────────────────────────▼────────────────────────────────┐ │
  │  │  BullMQ + Redis (NEW)                                   │ │
  │  │  ApproveTimerJob — fires when yellow auto_approve_at    │ │
  │  │  DigestJob       — daily/weekly mission summary         │ │
  │  │  BudgetWatchJob  — checks spend vs cap every 5min      │ │
  │  │  MetricsPollJob  — agent metrics refresh every 15min   │ │
  │  └────────────────────────┬────────────────────────────────┘ │
  │                           │                                   │
  │  ┌────────────────────────▼────────────────────────────────┐ │
  │  │  Notification Router (NEW — extends existing services)  │ │
  │  │  TelegramAdapter  — text + inline buttons (EXTEND)      │ │
  │  │  SlackAdapter     — text + action blocks (EXTEND)       │ │
  │  │  EmailAdapter     — Resend + React Email (NEW)          │ │
  │  │  WebPushAdapter   — VAPID web-push (NEW)                │ │
  │  │  WebhookAdapter   — generic POST, covers Activepieces   │ │
  │  │                     Zapier, Make, AutomationHub         │ │
  │  │  All channels → same idempotent endpoint:               │ │
  │  │  PATCH /api/approvals/:id (status=pending guard)        │ │
  │  └────────────────────────┬────────────────────────────────┘ │
  │                           │                                   │
  │  EXISTING (unchanged):    │                                   │
  │  Heartbeat Orchestrator ──┘ (EXTENDED: injects mission ctx)  │
  │  Integration Awareness (Phase 6 — wired to missions)         │
  │  Webhooks: Stripe → revenue_events (already live)            │
  │  Webhooks: Crypto → revenue_events (NEW: Coinbase + Crossmint)│
  └──────────────────────────┬───────────────────────────────────┘
                             │ mission context + metrics tools
  ┌──────────────────────────▼───────────────────────────────────┐
  │  AGENT RUNTIME                                               │
  │                                                              │
  │  CEO (MiniMax-M2.5 / any configured model)                   │
  │    ├─ Tool: paperclip_get_active_mission (NEW)               │
  │    ├─ Tool: paperclip_propose_action (NEW — risk-tier gate)  │
  │    ├─ Tool: paperclip_get_company_metrics (NEW)              │
  │    ├─ Tool: paperclip_get_revenue_trend (NEW)                │
  │    └─ Tool: paperclip_get_integration_status (NEW)           │
  │    Skill: mission-coordinator.md (NEW)                       │
  │    Skill: company-brain.md (user-defined, NEW)               │
  │                                                              │
  │  CTO / CPO / CSO / PM / Builder / QA / ReleaseOps           │
  │    (existing tools + same new metric tools)                  │
  │                                                              │
  │  Execution via adapters:                                     │
  │    claude-local → Claude Code (file edits, tests)            │
  │    codex-local  → Codex (code generation)                    │
  │    openclaw     → OpenClaw (external system actions)         │
  │    process      → Alibaba/any model worker                   │
  │    http         → any webhook endpoint                       │
  └──────────────────────────┬───────────────────────────────────┘
                             │ triggers
  ┌──────────────────────────▼───────────────────────────────────┐
  │  ACTIVEPIECES (self-hosted, NEW)                             │
  │  Triggered by agents via HTTP adapter / webhook              │
  │  Executes: Twitter/X post, LinkedIn post, Instagram,         │
  │            Vercel deploy, email campaign, etc.               │
  │  330+ built-in pieces. Agents trigger; Activepieces acts.   │
  └──────────────────────────────────────────────────────────────┘

Notification fan-out:
  Telegram (inline buttons) · Slack (action blocks)
  Email (magic link) · Web Push (mobile badge) · Webhook
  → All resolve via: PATCH /api/approvals/:id (idempotent)

Crypto payments fan-out:
  Crossmint (Web3/NFT/agent cards) · Coinbase Commerce (simple)
  MoonPay Commerce (USDC/subscriptions)
  → All webhooks → PATCH /api/companies/:id/webhooks/crypto-[provider]
  → revenue_events (same pattern as Stripe)
```

---

## 5. New Data Models

Only tables that do not already exist. Add migrations in order A→H.

### Phase A: Mission Layer

```sql
-- missions
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  objectives TEXT[] NOT NULL DEFAULT '{}',     -- SMART goal strings
  status TEXT NOT NULL DEFAULT 'draft',         -- draft|active|paused|completed|failed
  autonomy_level TEXT NOT NULL DEFAULT 'copilot', -- assisted|copilot|autopilot
  budget_cap_usd DECIMAL(10,4),                 -- NULL = no cap
  digest_schedule TEXT NOT NULL DEFAULT 'daily', -- realtime|hourly|daily|weekly
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Enforce: one active mission per company at a time
CREATE UNIQUE INDEX missions_one_active_per_company
  ON missions(company_id) WHERE status = 'active';

-- mission_approval_rules
CREATE TABLE mission_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,         -- 'deploy_prod'|'social_post'|'user_data'|etc.
  risk_tier TEXT NOT NULL DEFAULT 'yellow', -- green|yellow|red
  auto_approve_after_min INTEGER,    -- NULL = never auto-approve (red always null)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- mission_notification_channels
CREATE TABLE mission_notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,        -- telegram|slack|email|webpush|webhook
  config JSONB NOT NULL DEFAULT '{}', -- encrypted at rest via company_secrets pattern
  triggers TEXT[] NOT NULL DEFAULT '{}', -- approval_required|blocker|digest|budget_warning|completed
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,  -- delivery order
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend existing approvals table (4 new columns via migration)
ALTER TABLE approvals
  ADD COLUMN mission_id UUID REFERENCES missions(id),
  ADD COLUMN action_type TEXT,
  ADD COLUMN risk_tier TEXT,           -- yellow|red
  ADD COLUMN auto_approve_at TIMESTAMPTZ, -- set by BullMQ on creation
  ADD COLUMN resolved_via TEXT;        -- 'telegram'|'slack'|'email'|'web'|'auto'
```

### Phase F: Company Brain (Knowledge Base)

```sql
-- company_knowledge_docs
CREATE TABLE company_knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,             -- markdown, stored as-is
  doc_type TEXT NOT NULL DEFAULT 'general', -- general|brand|product|technical|customer
  injected_to TEXT[] NOT NULL DEFAULT '{}', -- agent roles that receive this: ['ceo','cso','all']
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Phase H: Crypto & Templates

```sql
-- crypto_payment_configs (per company, per provider)
CREATE TABLE crypto_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,            -- 'coinbase_commerce'|'crossmint'|'moonpay'
  config JSONB NOT NULL DEFAULT '{}', -- provider-specific config (secret_ref pattern)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- company_templates (export/import)
CREATE TABLE company_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- saas|ecommerce|marketing|web3|general
  template_data JSONB NOT NULL,      -- full company snapshot: agents, skills, approval_rules
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Default Risk Tier Table

Pre-seeded into `mission_approval_rules` when a mission is created.
All tiers overridable per mission via the Mission Wizard UI.

| action_type | Default Tier | Auto-approve (min) | Notes |
|-------------|-------------|-------------------|-------|
| `code_fix` | green | instant | Bug fixes, refactors |
| `write_test` | green | instant | Test authoring |
| `write_doc` | green | instant | Documentation |
| `read_analytics` | green | instant | Read-only |
| `read_revenue` | green | instant | Read-only |
| `staging_deploy` | yellow | 60 | Staging environment only |
| `dependency_update` | yellow | 60 | Package updates |
| `social_post_draft` | yellow | 30 | Content for review |
| `email_campaign` | yellow | 120 | Newsletter / outbound |
| `social_post_publish` | yellow | 30 | Needs review |
| `production_deploy` | red | never | Always require tap |
| `user_data_change` | red | never | Privacy-sensitive |
| `paid_integration` | red | never | Costs money |
| `pricing_change` | red | never | Revenue impact |
| `public_announcement` | red | never | Brand impact |
| `crypto_payout` | red | never | Irreversible |
| `delete_data` | red | never | Irreversible |

---

## 7. Agent New Tools (multi_model_worker.py additions)

Add these 5 tools to the existing 7. The worker already has the tool-use loop — just append to the tools list.

```python
# Tool 8: Get active mission context
paperclip_get_active_mission()
# Returns:
# { active: false } if no mission running → agent reports idle, stops
# { active: true, mission_id, title, objectives[], autonomy_level,
#   budget_remaining_usd, days_remaining, top_priorities[] }

# Tool 9: Propose an action (risk-tier gate)
paperclip_propose_action(action_type: str, description: str, impact_summary: str)
# Server evaluates risk tier from mission_approval_rules
# Green  → { approved: true } — proceed immediately
# Yellow → { approved: false, pending_id, auto_approve_at } — wait or poll
# Red    → { approved: false, pending_id, auto_approve_at: null } — wait for human
# Agent MUST NOT execute yellow/red actions until approved

# Tool 10: Get company metrics snapshot
paperclip_get_company_metrics()
# Returns: { mrr_usd, user_count, open_bugs, open_issues,
#            last_deploy_at, integrations_connected[], budget_used_pct }

# Tool 11: Get revenue trend (last 30 days)
paperclip_get_revenue_trend()
# Returns: { events: [{date, amount_usd, source, type}], total_30d_usd,
#            growth_pct_wow, top_source }

# Tool 12: Get integration status
paperclip_get_integration_status()
# Returns: { integrations: [{id, name, connected, last_checked_at, healthy}] }
# Agent uses this to know what actions are available to it
```

### New CEO Skill: mission-coordinator.md

Located at `skills/mission-coordinator/SKILL.md`. Injected via `PAPERCLIP_REQUIRED_SKILLS`.

Key instructions:
1. First tool call every heartbeat: `paperclip_get_active_mission`
2. If `active: false` → post "No active mission. Awaiting Board direction." → stop
3. Read `objectives` → decompose into today's top 3 priorities
4. Check `budget_remaining_usd`: if < 20% → conservative mode (no deploys, no social)
5. For ANY external action → call `paperclip_propose_action` FIRST
6. End of heartbeat: call `paperclip_get_company_metrics` → post progress update
7. If metrics show regression (MRR down, errors up) → create improvement issue labeled `proposed-improvement`

### Company Brain Injection

When heartbeat starts, server fetches active `company_knowledge_docs` for agent role,
prepends to system prompt before skill injection. Order: Knowledge Docs → Skills → Role Prompt.

---

## 8. UX Design — Key Screens

### 8.1 Dashboard (Mobile — primary use)

```
┌─────────────────────────────────────┐
│  Paperclip             [avatar] [+] │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ Mission: "Reach $1K MRR"     │  │
│  │ Day 4 of 14                   │  │
│  │ ████████░░░░░░  34% complete  │  │
│  │ $4.20 / $20.00 budget         │  │
│  │            [Pause]  [Details] │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌────────────────┐ ┌─────────────┐ │
│  │ ⏳ Approvals 3 │ │ 5 Agents   │ │
│  │ Tap to review  │ │ 4 active   │ │
│  └────────────────┘ └─────────────┘ │
│                                     │
│  ┌────────────────┐ ┌─────────────┐ │
│  │ $297 MRR       │ │ $4.20 today│ │
│  │ +12% this week │ │ 21% budget │ │
│  └────────────────┘ └─────────────┘ │
│                                     │
│  -- Activity Feed ────────────────  │
│  Builder fixed auth bug      2m ago │
│  CSO posted to LinkedIn     18m ago │
│  QA: all tests passing      31m ago │
│  ReleaseOps: awaiting approve  now  │
│                                     │
│  -- Integration Alerts ───────────  │
│  Vercel not connected               │
│  [Set up in 2 min →]               │
├─────────────────────────────────────┤
│  Home   Tasks   Agents  (3) Settings│
└─────────────────────────────────────┘
```

### 8.2 Approval Queue (Mobile — swipe UX)

```
┌─────────────────────────────────────┐
│  Approvals (3)                      │
│  Swipe right to approve             │
│  Swipe left to reject               │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ 🔴 Production Deploy          │  │
│  │ ReleaseOps wants to deploy    │  │
│  │ v1.3 to Vercel production.    │  │
│  │ Affects: 847 active users.    │  │
│  │                               │  │
│  │   ← Reject     Approve →     │  │  ← swipe gesture + buttons
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🟡 Newsletter Send            │  │
│  │ CPO: April product update     │  │
│  │ to 2,340 subscribers.         │  │
│  │ Auto-approves in 1h 42m       │  │
│  │                               │  │
│  │   ← Reject     Approve →     │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🟡 LinkedIn Post              │  │
│  │ CSO: "We just shipped X..."   │  │
│  │ [Preview post]                │  │
│  │ Auto-approves in 28m          │  │
│  │   ← Reject     Approve →     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 8.3 Mission Creation Wizard (5 steps, mobile-optimized)

```
Step 1/5 — What's the goal?
  ┌────────────────────────────────────┐
  │ "Get to $1K MRR by April 30"      │
  │ or pick a template:               │
  │  🚀 Ship a Feature                │
  │  🐛 Fix All Bugs                  │
  │  📈 Grow to [N] Users             │
  │  📣 Marketing Sprint              │
  │  💰 Revenue Push to $1K MRR      │
  └────────────────────────────────────┘

Step 2/5 — How autonomous?
  ○ Assisted  — I approve deploys + posts
  ● Copilot   — I only approve prod deploys   ← recommended
  ○ Autopilot — Budget cap is my only limit

Step 3/5 — Budget cap
  [$20] per mission    [No cap]

Step 4/5 — How do you want updates?
  ☑ Telegram   ☑ Email   ☐ Slack   ☐ Webhook
  ○ Real-time  ● Daily digest  ○ Weekly

Step 5/5 — Review & Launch
  Goal: "Get to $1K MRR by April 30"
  Mode: Copilot | Budget: $20 | Updates: Telegram + Email daily
  [Launch Mission →]
```

### 8.4 Company Brain (Knowledge Base UI)

Navigation: Settings → Company → Brain tab

```
Company Brain
"Context documents injected into agent prompts"
[+ Add Document]

┌─────────────────────────────────────┐
│ Product Overview              [Edit]│
│ Type: Product · All agents          │
│ "We're building a B2B SaaS that..." │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Brand Voice                   [Edit]│
│ Type: Brand · CSO, CPO             │
│ "We write with confidence..."       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Tech Stack                    [Edit]│
│ Type: Technical · CTO, Builder     │
│ "React 19 + TypeScript, Hono..."   │
└─────────────────────────────────────┘
```

### 8.5 Onboarding Wizard Enhancement (add Step 2.5)

Insert between adapter selection and CEO setup:

```
Step 2.5/4 — Connect your tools (recommended)
"Agents work best when connected to your stack"

  ┌──────────────────────────────────┐
  │ Based on your goal, we suggest:  │
  │                                  │
  │  GitHub        [Connect →]  ★    │
  │  "Agents push code to your repo" │
  │                                  │
  │  Vercel        [Connect →]  ★    │
  │  "ReleaseOps deploys your app"   │
  │                                  │
  │  Stripe        [Connect →]       │
  │  "Track revenue automatically"   │
  │                                  │
  │  Telegram      [Connect →]       │
  │  "Approve decisions from phone"  │
  └──────────────────────────────────┘
  [Skip for now]  [Continue →]
```

### 8.6 Agent Capability Card (AgentDetail enhancement)

Add "Capabilities" section to existing AgentDetail page:

```
Capabilities
"What this agent can do based on connected integrations"

  Can deploy:    Vercel ✓
  Can post to:   LinkedIn ✓  Twitter/X ✓
  Can track:     Revenue (Stripe) ✓  Analytics (Plausible) ✓
  Can notify:    Telegram ✓  Email ✓
  Missing:       Instagram — connect in Integrations
```

---

## 9. Integration Ecosystem — Full Catalog Additions

Add these to `integrationConfigs.ts` and `server/src/routes/integrations.ts`:

### Social Media (via Activepieces webhook trigger)

| Integration | Category | Setup | Agents use it for |
|-------------|----------|-------|-------------------|
| Twitter/X | social | Activepieces webhook URL | CSO posts, announcements |
| LinkedIn | social | Activepieces webhook URL | CSO posts, job listings |
| Instagram | social | Activepieces webhook URL | CSO visual content |
| Buffer | social | API key | Alternative social scheduler |

**Pattern:** User installs Activepieces locally or cloud. Creates a workflow: "When called via HTTP → post to Twitter." Copies webhook URL into Paperclip. Agents call the webhook. Zero OAuth in Paperclip — Activepieces handles it.

### Deploy Platforms

| Integration | Category | Setup time | How |
|-------------|----------|-----------|-----|
| Vercel | deploy | 2 min | Deploy Hook URL (no OAuth) — POST to URL = redeploy |
| Railway | deploy | 3 min | Deploy webhook URL |
| Fly.io | deploy | 5 min | Fly API token + app name |
| Coolify | deploy | Self-hosted | Webhook URL (open source Heroku) |

### Crypto Payments

| Provider | Best for | Setup | Model |
|----------|----------|-------|-------|
| **Crossmint** | Web3/NFT, AI agent cards | API key + webhook | Agent virtual cards; 40+ chains; easiest for digital goods |
| **Coinbase Commerce** | Simple crypto acceptance | API key + webhook | Mirrors Stripe pattern; free; most trusted |
| **MoonPay Commerce** | USDC subscriptions | API key + widget | Best for recurring digital goods |

All three use the same webhook pattern as Stripe: `POST /api/companies/:id/webhooks/crypto-:provider` → `revenue_events`.

### Analytics (agents can read, not just connect)

| Integration | Read API | What agents get |
|-------------|----------|----------------|
| Plausible | REST API | pageviews, sources, bounce rate, top content |
| PostHog | REST API | events, funnels, user cohorts, feature flag usage |
| Google Analytics 4 | Data API | same as Plausible |

---

## 10. Notification Router — Technical Spec

### Race condition prevention (critical)

All channels call the same endpoint:
```
PATCH /api/approvals/:id
Body: { decision: 'approved' | 'rejected', resolved_via: string }
```

Implementation uses atomic DB update:
```sql
UPDATE approvals
SET status = $decision, resolved_via = $via, decided_at = NOW()
WHERE id = $id AND status = 'pending'
RETURNING *;
```

If `RETURNING` is empty (0 rows) → already resolved → return 200 with current state. No error. No double-processing. All channels are safe to call simultaneously.

### Telegram Interactive Approval (extend telegram-notifier.ts)

When `sendApprovalRequest(approvalId, description, riskTier)` is called:

```typescript
bot.sendMessage(chatId, description, {
  reply_markup: {
    inline_keyboard: [[
      { text: '✓ Approve', callback_data: `approve:${approvalId}` },
      { text: '✗ Reject',  callback_data: `reject:${approvalId}`  }
    ]]
  }
})
```

Callback handler (`POST /api/telegram/callback`):
```typescript
const [decision, approvalId] = callbackQuery.data.split(':')
await approvalService.resolve(approvalId, decision, 'telegram')
await bot.answerCallbackQuery(callbackQuery.id, { text: 'Decision recorded.' })
```

### BullMQ Auto-approve Timer

On `yellow` approval request creation:
```typescript
const job = await approveTimerQueue.add('auto-approve', { approvalId }, {
  delay: autoApproveAfterMin * 60 * 1000,
  jobId: `auto-approve-${approvalId}`, // idempotent
})
// Store job.id in approvals.bull_job_id for cancellation
```

On manual resolution → cancel timer:
```typescript
await approveTimerQueue.remove(`auto-approve-${approvalId}`)
```

---

## 11. Implementation Phases

Execute in strict order. Each phase has a verification gate — do not start the next phase until the gate passes.

---

### Phase A — Mission Foundation
**Goal:** Mission entity exists, CRUD works, state machine enforced.

**Touch list:**
- `packages/db/src/schema/missions.ts` — CREATE
- `packages/db/src/schema/mission_approval_rules.ts` — CREATE
- `packages/db/src/schema/mission_notification_channels.ts` — CREATE
- `packages/db/src/schema/index.ts` — EDIT (export new tables)
- `packages/db/src/migrations/` — GENERATE migration
- `packages/shared/src/types/mission.ts` — CREATE (types + zod validators)
- `packages/shared/src/types/index.ts` — EDIT (export)
- `server/src/services/mission-engine.ts` — CREATE (XState machine, CRUD, budget check)
- `server/src/routes/missions.ts` — CREATE (GET/POST/PATCH/DELETE)
- `server/src/routes/index.ts` — EDIT (mount missions routes)
- `packages/db/src/schema/approvals.ts` — EDIT (add 5 new columns migration)

**Verification:**
```bash
pnpm db:generate && pnpm db:migrate
pnpm --filter @paperclipai/server typecheck
curl -s http://localhost:3100/api/companies/:id/missions | python3 -m json.tool
# Should return { missions: [] }
# POST a mission, verify unique active constraint by posting a second → 409
```

---

### Phase B — BullMQ Job Queue
**Goal:** Redis running, auto-approve timers work, digest scheduled.

**Touch list:**
- `docker-compose.yml` — EDIT (add redis service)
- `docker-compose.quickstart.yml` — EDIT (add redis)
- `server/package.json` — EDIT (add bullmq, ioredis)
- `server/src/services/queue.ts` — CREATE (BullMQ setup, queue definitions)
- `server/src/services/jobs/approve-timer.ts` — CREATE
- `server/src/services/jobs/digest.ts` — CREATE
- `server/src/services/jobs/budget-watcher.ts` — CREATE
- `server/src/index.ts` — EDIT (start queue workers on server boot)
- `server/src/routes/approvals.ts` — EDIT (cancel BullMQ job on manual resolve)

**Verification:**
```bash
docker-compose up redis -d
# Create a yellow approval with auto_approve_after_min=1
# Wait 65 seconds
# Verify approval status = 'auto_approved' and resolved_via = 'auto'
pnpm --filter @paperclipai/server typecheck
```

---

### Phase C — Notification Delivery
**Goal:** Telegram inline buttons work. Email sends. Web Push works. Webhook fires.

**Touch list:**
- `server/package.json` — EDIT (add node-telegram-bot-api, web-push, resend, @react-email/components)
- `server/src/services/telegram-notifier.ts` — EDIT (add inline keyboard approval method)
- `server/src/services/notification-router.ts` — CREATE (adapter interface + dispatcher)
- `server/src/services/adapters/email-adapter.ts` — CREATE (Resend + React Email)
- `server/src/services/adapters/webpush-adapter.ts` — CREATE (VAPID web-push)
- `server/src/services/adapters/webhook-adapter.ts` — CREATE (generic POST)
- `server/src/routes/telegram-callback.ts` — CREATE (callback_query handler)
- `server/src/routes/approvals.ts` — EDIT (idempotent PATCH resolve endpoint)
- `server/src/routes/index.ts` — EDIT (mount telegram-callback)
- `ui/src/api/push.ts` — CREATE (subscribe to Web Push on load)

**Verification:**
```bash
# Create test approval request
# Verify Telegram message has [✓ Approve][✗ Reject] buttons
# Tap Approve in Telegram → verify approval status = 'approved', resolved_via = 'telegram'
# Simulate second tap → verify 200 returned with same state (idempotent)
# Send test email → verify received in inbox
pnpm --filter @paperclipai/server typecheck
```

---

### Phase D — Agent Metrics Tools + CEO Auto-Improve
**Goal:** Agents can read metrics. CEO proposes improvements based on data.

**Touch list:**
- `~/.paperclip/workers/multi_model_worker.py` — EDIT (add 5 new tool definitions)
- `server/src/routes/agent-tools.ts` — CREATE (endpoints for new tools)
- `server/src/services/agent-metrics.ts` — CREATE (aggregate metrics from DB)
- `server/src/routes/index.ts` — EDIT (mount agent-tools)
- `skills/mission-coordinator/SKILL.md` — CREATE
- `server/src/services/heartbeat.ts` — EDIT (inject mission context + knowledge docs before agent wake)
- `server/src/services/company-brain.ts` — CREATE (fetch + inject knowledge docs)

**Verification:**
```bash
# Start CEO agent with active mission
# Verify heartbeat log shows mission context injected
# Verify CEO reads metrics and posts summary comment
# Simulate MRR drop → verify CEO creates proposed-improvement issue
pnpm --filter @paperclipai/server typecheck
```

---

### Phase E — Social + Deploy Integrations
**Goal:** CSO can post to social. ReleaseOps can deploy. Activepieces wired.

**Touch list:**
- `ui/src/components/settings/integrationConfigs.ts` — EDIT (add twitter, linkedin, instagram, vercel, railway, fly, activepieces)
- `server/src/routes/integrations.ts` — EDIT (add verify endpoints for new integrations)
- `server/src/routes/webhooks.ts` — EDIT (add crypto webhook handlers: coinbase, crossmint, moonpay)
- `server/src/services/revenue.ts` — EDIT (handle crypto payment events → revenue_events)
- `packages/db/src/schema/crypto_payment_configs.ts` — CREATE
- `ui/src/components/settings/integrationConfigs.ts` — EDIT (add crypto payment section)

**Verification:**
```bash
# Connect a Vercel deploy hook URL
# Agent calls paperclip_propose_action('staging_deploy', ...)
# Verify Vercel deploy triggered after approval
# POST fake Coinbase Commerce webhook → verify revenue_events record created
pnpm --filter @paperclipai/server typecheck
```

---

### Phase F — Company Brain (Knowledge Base UI)
**Goal:** Users can add knowledge docs. Agents receive them in system prompts.

**Touch list:**
- `packages/db/src/schema/company_knowledge_docs.ts` — CREATE
- `packages/db/src/schema/index.ts` — EDIT
- `packages/db/src/migrations/` — GENERATE
- `packages/shared/src/types/knowledge.ts` — CREATE
- `server/src/services/company-brain.ts` — EDIT (fetch docs by agent role)
- `server/src/routes/knowledge.ts` — CREATE (CRUD API)
- `server/src/routes/index.ts` — EDIT
- `ui/src/pages/settings/Brain.tsx` — CREATE (knowledge editor using @mdxeditor)
- `ui/src/api/knowledge.ts` — CREATE
- `ui/src/pages/Settings.tsx` — EDIT (add Brain tab)

**Verification:**
```bash
# Create a "Brand Voice" knowledge doc, assign to 'cso'
# Start CSO heartbeat
# Verify brand voice doc appears in CSO system prompt in run log
pnpm --filter @paperclipai/server typecheck
```

---

### Phase G — Mission Board UI + Approval Queue + PWA
**Goal:** Full mission UX. Swipe approvals. App installable on iPhone.

**Touch list:**
- `ui/package.json` — EDIT (add @use-gesture/react, vite-plugin-pwa)
- `ui/vite.config.ts` — EDIT (add vite-plugin-pwa config)
- `ui/src/pages/Missions.tsx` — CREATE (mission list + mission card)
- `ui/src/pages/MissionWizard.tsx` — CREATE (5-step wizard)
- `ui/src/pages/Approvals.tsx` — CREATE (swipe-to-approve queue)
- `ui/src/components/MissionStatusCard.tsx` — CREATE (dashboard widget)
- `ui/src/components/ApprovalCard.tsx` — CREATE (swipeable card)
- `ui/src/pages/Dashboard.tsx` — EDIT (add MissionStatusCard + approval badge)
- `ui/src/App.tsx` — EDIT (add /missions route, /approvals route)
- `ui/src/components/Layout.tsx` — EDIT (add Approvals to bottom nav with badge)
- `ui/src/api/missions.ts` — CREATE
- `ui/src/api/approvals.ts` — CREATE (if not exists, extend)

**PWA config (vite-plugin-pwa):**
```typescript
// vite.config.ts addition
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Paperclip',
    short_name: 'Paperclip',
    theme_color: '#0f0f0f',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    display: 'standalone',
    start_url: '/',
  },
  workbox: {
    runtimeCaching: [{
      urlPattern: /\/api\/companies\/.+\/approvals/,
      handler: 'NetworkFirst',
      options: { cacheName: 'approvals-cache' },
    }],
  },
})
```

**Verification:**
```bash
# Open app on iPhone Safari → "Add to Home Screen" prompt appears
# Create mission via wizard (all 5 steps)
# Verify mission card appears on dashboard
# Navigate to Approvals → swipe right on yellow approval → status = 'approved'
# Swipe left → status = 'rejected'
pnpm --filter @paperclipai/ui typecheck
pnpm build
```

---

### Phase H — Growth Features + Audit Log + Templates
**Goal:** Company export/import. Audit log UI. Enhanced onboarding.

**Touch list:**
- `packages/db/src/schema/company_templates.ts` — CREATE
- `server/src/services/template-engine.ts` — CREATE (export + import company snapshot)
- `server/src/routes/templates.ts` — CREATE
- `ui/src/pages/Templates.tsx` — CREATE (5 pre-built template cards + import)
- `ui/src/pages/settings/AuditLog.tsx` — CREATE (activity_log table rendered)
- `ui/src/pages/Settings.tsx` — EDIT (add Audit Log tab)
- `ui/src/components/OnboardingWizard.tsx` — EDIT (add Step 2.5: integrations during setup)
- `ui/src/pages/AgentDetail.tsx` — EDIT (add Capabilities section)
- `server/src/routes/index.ts` — EDIT (mount templates route)

**Pre-built templates to seed:**
1. SaaS Startup (CEO + CTO + CPO + Builder + QA + ReleaseOps)
2. Marketing Agency (CEO + CMO + CSO + Content + Analytics)
3. E-commerce (CEO + PM + Builder + Support + Marketing)
4. Web3 Project (CEO + CTO + Smart Contract Dev + Community Manager)
5. Solo Founder (CEO + Builder + QA — minimal team)

**Verification:**
```bash
# Export existing company → verify JSON snapshot complete
# Import snapshot into new company → verify all agents + skills restored
# Go through onboarding with goal "get to $1K MRR" → verify Stripe + Vercel suggested in step 2.5
# Open AgentDetail for CSO → verify Capabilities card shows connected integrations
pnpm --filter @paperclipai/server typecheck
pnpm build
```

---

## 12. Brain Protocol Boundary Rule

Add this to `Paperclip/AGENTS.md` (one paragraph, no other changes to that file):

> **Directory boundary:** Paperclip agents (CEO, CTO, and all role agents) operate only within project repositories assigned to them and the Paperclip issue system. They must never read, write, reference, or modify any path under `.agent/` or `vault/` at the portfolio root. Those directories are managed exclusively by the Portfolio Steward (brain protocol layer). The only shared surface is GitHub — both layers may read and write to project repositories via git operations.

---

## 13. Success Metrics (Verify Before APPROVED)

| Metric | Target | How to measure |
|--------|--------|---------------|
| Mission creation → first agent action | < 5 min | Time from Launch tap to first heartbeat run |
| Approval from Telegram | < 10 sec round-trip | Time from button creation to status update |
| Dashboard load (mobile 4G) | < 800ms | Chrome DevTools throttled network |
| Mission widget MRR accuracy | Matches revenue_events sum | Manual spot-check vs DB query |
| Onboarding to first active agent | < 10 min | Timed walkthrough with fresh account |
| PWA installable on iPhone | Yes | Safari "Add to Home Screen" prompt appears |
| Auto-approve fires correctly | Within 2 min of scheduled time | BullMQ job timing test |
| Knowledge doc injected in agent prompt | Verified in run log | Search heartbeat log for doc title |
| Crossmint webhook → revenue_events | Yes | POST test webhook, verify DB record |
| Company export → import (roundtrip) | Lossless | Export → import → compare agent count + config |

---

## 14. Files NOT to Touch (Phase 5-6 Work — Stable)

Per `PHASE_STATE.md` — do not modify without explicit instruction:
- `ui/src/pages/settings/Governance.tsx`
- `server/src/routes/governance.ts`
- `server/src/lib/vision-gate.ts`
- `packages/db/src/schema/business_configs.ts`
- `packages/db/src/schema/business_kpis.ts`
- `ui/src/components/IntegrationBlockBanner.tsx`
- `ui/src/components/IntegrationBlockModal.tsx`
- Any file listed in `PHASE_STATE.md` under Phase5-6-Complete

---

*Design approved by: Board (user) on 2026-03-23*
*Next step: writing-plans skill to generate per-phase implementation handoff packets*
