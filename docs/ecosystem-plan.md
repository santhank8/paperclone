# The Ecosystem — Platform Plan

> One brand. Three layers. Every layer feeds the others.

---

## The Insight

Tools compete on features. Platforms compete on ecosystems. We have three things that individually are strong products — but connected, they're a flywheel that nobody else has.

```
                    ┌─────────────────────┐
                    │        GROW         │
                    │   The Factory       │
                    │                     │
                    │ Research → Build →  │
                    │ QC → Optimize →     │
                    │ Publish             │
                    └────────┬────────────┘
                             │ produces
                             ▼
  ┌──────────────────────────────────────────────┐
  │                    RUN                        │
  │              Autonomous Teams                 │
  │                                               │
  │  Templates │ Pipelines │ Managed Hosting      │
  │  "Hire an AI team in 60 seconds"              │
  └──────────────────────┬────────────────────────┘
                         │ built with
                         ▼
              ┌─────────────────────┐
              │        BUILD        │
              │    Dev Workflow      │
              │                     │
              │ PRD → Spec → Loop → │
              │ Review → Ship       │
              └─────────────────────┘

  FLYWHEEL:
  Build creates the product (Run)
  Run generates usage data + feedback
  Grow uses feedback to produce better skills/agents
  Better skills make Build more powerful
  Repeat ♻️
```

---

## The Three Layers

### Layer 1: BUILD — "From idea to shipped product"

**What it is:** A guided dev workflow that takes you from a blank page to a deployed product. Not a framework — a set of connected skills with a clear path.

**Who it's for:** Developers using Claude Code who want structure without a straitjacket. The people currently choosing between GSD (too heavy), Superpowers (no workflow), and vanilla Claude Code (no structure).

**What exists today:**
- `/create-prd` — guided project interview
- `/create-spec` — breaks features into TASK.md files
- `/spec-loop` — unattended implementation with fresh context per step
- `/plan-ceo-review` — strategic plan review
- `/plan-eng-review` — technical plan review
- `/review` — pre-landing code review
- `/ship` — merge, version, changelog, push, PR

**What's missing:**
- A single entry point that chains these together (`/build`)
- Clear "you are here" progression (step 1 of 7, not 50 disconnected skills)
- Workflow documentation (the #1 complaint about Superpowers)
- Brownfield support (existing projects, not just greenfield)
- This is what AIS-25 (Research) is investigating right now

**Revenue:** Free for individual skills. The workflow skill (`/build`) is the premium — available in paid tiers or as a standalone purchase on ClawHub.

---

### Layer 2: RUN — "Your AI team, managed"

**What it is:** A consumer-grade frontend on Paperclip that lets non-technical users deploy and manage autonomous AI teams. Pre-built templates for specific verticals.

**Who it's for:** Business owners, content creators, agency operators, solopreneurs. People who'd never open a terminal but want AI doing real work.

**What exists today:**
- Full Paperclip API knowledge (we've operated it harder than almost anyone)
- 5 working agents with handoff protocols
- Learnings loop + Optimizer (autoresearch-style)
- CLI installer (`npx aiskillslab install`)
- Skill catalog on Convex

**What's planned (from the frontend plan, reviewed today):**
- Next.js frontend with 5 core screens
- Team Dashboard, New Task, Pipeline View, Team Settings, Costs
- Pre-built templates: Content Studio, Agency Ops, Skill Factory
- Managed multi-tenant on Railway with Docker isolation
- LLM proxy sidecar for key security + metering
- Convex as realtime relay + billing
- Pipeline replay animation, cost-per-deliverable cards, agent personality
- Base subscription + usage markup pricing

**Revenue:** $0/Free → $49/Pro → $149/Team → Enterprise. Usage markup on LLM calls through OpenRouter.

---

### Layer 3: GROW — "The factory that never stops"

**What it is:** Our autonomous skill factory. Research finds opportunities, SkillBuilder builds them, QC gates quality, Optimizer refines. Every skill produced feeds Layer 1 (Build tools) or Layer 2 (Run templates).

**Who it's for:** Us. This is the engine. Users don't interact with Grow directly — they consume its output through Build and Run.

**What exists today:**
- Research agent with 6 data sources + smart routing + xAI Grok
- SkillBuilder with `/skill-magic` integration
- QC with review checklist + auto-publish + learnings
- Optimizer with 8-iteration keep/discard loop
- Cross-skill learnings system (`skills/learnings/`)
- 7 skills shipped, 2 autonomously in one session

**What's needed:**
- TutorialWriter agent (next in build order) — produces tutorials for each skill
- VideoProducer agent — creates video content from tutorials
- CustomerRelations auto-heartbeat — monitors inbox without manual task creation
- Template Builder agent — automatically creates Run templates from skill combinations
- Feedback loop from Run usage → Research priorities (build what users actually need)

**Revenue:** Indirect. Grow produces the inventory that Build and Run sell.

---

## The Flywheel

This is what makes it a platform, not a product:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   GROW produces skills/agents                            │
│     ↓                                                    │
│   Skills feed into BUILD (dev workflow tools)            │
│     ↓                                                    │
│   BUILD is used to create RUN (the frontend product)     │
│     ↓                                                    │
│   RUN generates user data (what tasks, what costs,       │
│   what fails, what templates people want)                │
│     ↓                                                    │
│   User data feeds back to GROW (Research priorities)     │
│     ↓                                                    │
│   GROW produces better skills/agents                     │
│     ↓                                                    │
│   ...repeat forever                                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key insight:** Each layer creates demand for the others.
- Build users want more skills → Grow produces them
- Run users want more templates → Grow researches, Build implements
- Grow needs direction → Run usage data tells it what to build next
- Build gets better tools → we build Run faster → more users → more data → Grow gets smarter

This is why it's defensible. A competitor can copy any one layer. They can't copy the flywheel because it requires all three running simultaneously, feeding each other.

---

## Unified Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE ECOSYSTEM                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SHARED INFRASTRUCTURE                     │    │
│  │                                                              │    │
│  │  Convex ─── user accounts, billing, skill catalog,          │    │
│  │             usage events, realtime relay, templates          │    │
│  │                                                              │    │
│  │  Paperclip ─── agent orchestration, issue tracking,         │    │
│  │                handoffs, cost tracking, company isolation    │    │
│  │                                                              │    │
│  │  OpenRouter ─── multi-model LLM access, cost control        │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │     BUILD      │  │      RUN      │  │        GROW           │   │
│  │                │  │               │  │                       │   │
│  │ Claude Code    │  │ Next.js App   │  │ Paperclip Agents      │   │
│  │ Skills         │  │ (Vercel)      │  │ (Railway)             │   │
│  │ (~/.claude/    │  │               │  │                       │   │
│  │  skills/)      │  │ Team Dashboard│  │ Research              │   │
│  │                │  │ Task Creation │  │ SkillBuilder          │   │
│  │ /build         │  │ Pipeline View │  │ QC                    │   │
│  │ /create-prd    │  │ Cost Tracking │  │ Optimizer             │   │
│  │ /create-spec   │  │ Templates     │  │ TutorialWriter        │   │
│  │ /spec-loop     │  │               │  │ VideoProducer         │   │
│  │ /review        │  │ Mobile App    │  │                       │   │
│  │ /ship          │  │ Telegram Bot  │  │ Learnings Loop        │   │
│  │                │  │               │  │ Auto-publish          │   │
│  │ Free +         │  │ $0-149/mo +   │  │ Internal              │   │
│  │ Premium skills │  │ usage markup  │  │ (no direct revenue)   │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘   │
│          │                  │                       │               │
│          └──────────────────┼───────────────────────┘               │
│                             │                                       │
│                    ┌────────▼────────┐                              │
│                    │  SKILL CATALOG  │                              │
│                    │  (Convex DB)    │                              │
│                    │                 │                              │
│                    │  Skills feed    │                              │
│                    │  into BUILD     │                              │
│                    │  Templates feed │                              │
│                    │  into RUN       │                              │
│                    └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Journeys

### Journey 1: The Developer
1. Discovers a skill on ClawHub or our catalog
2. `npx aiskillslab install autonomous-agent` → uses it → impressed
3. Discovers `/build` workflow → uses it to ship a side project
4. Becomes a power user → buys Pro tier for premium skills
5. Builds their own skills → submits to our marketplace
6. **Expansion:** Uses RUN to deploy an AI team for their freelance clients

### Journey 2: The Business Owner
1. Sees the "Your AI team" ad / hears about it from a developer friend
2. Signs up → picks "Content Studio" template → answers brand questions
3. Creates first task: "Write a blog post about our new product"
4. Watches pipeline replay → sees deliverable → "$0.47 vs $300" card → hooked
5. Upgrades to Pro → runs 20+ tasks/month → morning briefings via Slack
6. **Expansion:** Hires us for custom template development (Enterprise)

### Journey 3: The Agency
1. Uses BUILD to create client deliverables faster
2. Discovers RUN → deploys a team per client
3. White-labels the frontend → resells to their own clients
4. **Expansion:** Creates custom templates → sells on marketplace

---

## Revenue Model (unified)

| Source | Layer | Model | Target |
|---|---|---|---|
| Skill purchases | BUILD | One-time or subscription | $5-20/skill or $19/mo all-access |
| Platform subscription | RUN | Monthly recurring | $0 / $49 / $149 / Custom |
| Usage markup | RUN | Per-task (1.5-2x LLM cost) | Variable, ~$20-50/user/month |
| Marketplace cut | BUILD + RUN | 30% of third-party sales | Variable, grows with ecosystem |
| Enterprise / white-label | RUN | Custom contracts | $500+/mo |
| Custom template development | GROW | Project-based | $2K-10K per template |

**Year 1 target mix:**
- 60% Platform subscriptions (RUN)
- 25% Usage markup (RUN)
- 10% Skill sales (BUILD)
- 5% Marketplace + custom (all layers)

---

## Phased Execution

### Phase 0: Foundation (NOW — next 2 weeks)
- [ ] Ship the workflow skill from AIS-25 Research (BUILD layer, immediate value)
- [ ] Landing page + waitlist for the RUN product
- [ ] Continue running GROW factory — build skills 8, 9, 10
- [ ] Name the ecosystem (see naming section below)
- [ ] Commit all untracked files in the paperclip repo

### Phase 1: BUILD Layer Public (weeks 2-4)
- [ ] `/build` skill — the unified workflow entry point
- [ ] Workflow documentation ("start here" guide)
- [ ] Publish to ClawHub + our catalog
- [ ] Content: tutorial + YouTube video on the workflow
- [ ] Start collecting user feedback (what breaks, what's confusing)

### Phase 2: RUN Layer MVP (weeks 4-8)
- [ ] Next.js frontend (5 core screens)
- [ ] Paperclip on Railway (managed multi-tenant)
- [ ] Docker isolation + LLM proxy sidecar
- [ ] Skill Factory template (dogfood our own setup)
- [ ] Content Studio template
- [ ] Auth + billing via Convex + Stripe
- [ ] Private beta with 5-10 users

### Phase 3: Connect the Layers (weeks 8-12)
- [ ] GROW output auto-publishes to both BUILD catalog and RUN templates
- [ ] RUN usage data feeds back to GROW Research priorities
- [ ] BUILD premium tier gates some skills behind subscription
- [ ] Marketplace v1 — users submit skills and templates
- [ ] Agency Ops template
- [ ] Mobile app (React Native)

### Phase 4: Flywheel Spins (weeks 12+)
- [ ] Telegram/Slack CEO agent
- [ ] Template marketplace with payment processing
- [ ] White-label for agencies
- [ ] TutorialWriter + VideoProducer agents producing content for every skill
- [ ] Self-hosted documentation for Enterprise
- [ ] Community contributions flowing into GROW

---

## Naming

The ecosystem needs a name that covers all three layers. "AI Skills Lab" works for BUILD but doesn't capture RUN or GROW.

**Candidates:**

| Name | Vibe | Domain availability |
|---|---|---|
| **Ensemble** | Agents working together, musical metaphor | ensemble.ai (check) |
| **Foundry** | Where things are built, industrial, serious | foundr.ai / usefoundry.com (check) |
| **Hive** | Collective intelligence, bees, autonomous | hive.ai (taken) |
| **Cortex** | The brain that runs your business | cortex.dev (check) |
| **Agentic** | Literally what it is | agentic.dev (check) |
| **Crew** | Your AI crew (but CrewAI exists) | — |
| **Forge** | Where things are made, strong, craftsman | useforge.dev (check) |
| **Conductor** | Orchestrating agents | conductor.ai (check) |

Sub-brands per layer:
- [Name] **Build** — the dev workflow
- [Name] **Teams** — the managed AI teams (RUN)
- [Name] **Factory** — the production engine (GROW, internal branding)

---

## Competitive Moat

| Competitor | What they have | What they don't |
|---|---|---|
| GSD / BMAD | Planning structure | No execution pipeline, no autonomous agents, no managed hosting |
| Superpowers | Tool suite | No workflow, no hosting, no agent teams |
| CrewAI | Multi-agent framework | No UI, no persistence, no quality gates, no learnings |
| Relevance AI | Agent builder UI | No pipeline handoffs, no QC, no dev workflow |
| AutoGen | Research framework | No product, no templates, no non-technical users |
| Paperclip (raw) | The orchestration engine | Dev-facing, no templates, no consumer UI |
| **Us** | **All three layers + the flywheel** | — |

**The moat is the flywheel.** Anyone can build one layer. Building all three simultaneously and connecting them so each feeds the others — that takes the operational knowledge we've built over months of running Paperclip agents, debugging handoffs, writing learnings loops, and shipping skills autonomously.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Paperclip breaks backward compat | Medium | HIGH | Version-pin, we can fork (MIT) |
| Claude Code changes skill format | Low | HIGH | We're close to the ecosystem, early adopter |
| Market doesn't pay for RUN tier | Medium | HIGH | Phase 0 waitlist validates before we build |
| GROW factory produces low-quality | Low | Medium | QC + Optimizer + learnings loop |
| Competitor copies the model | Medium | Low | Flywheel is the moat, execution speed matters |
| We spread too thin across 3 layers | HIGH | HIGH | Phase execution — one layer at a time, BUILD first |

---

## Success Metrics

| Metric | Phase 1 (month 1) | Phase 2 (month 3) | Phase 4 (month 6) |
|---|---|---|---|
| Skills published | 10 | 25 | 50+ |
| BUILD active users | 100 | 500 | 2000 |
| RUN paying companies | 0 | 20 | 200 |
| MRR | $0 | $2K | $15K |
| Skills in marketplace | 0 | 5 | 50 |
| Templates available | 1 | 5 | 15 |
| Factory output (skills/week) | 2 | 5 | 10 (community-contributed) |
