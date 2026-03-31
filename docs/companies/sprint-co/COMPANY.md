---
schema: agentcompanies/v1
kind: company
slug: sprint-co
name: Sprint Co — 3-Hour Scrum Sprint Studio
description: >
  An autonomous AI software company that delivers complete, shippable software in 3-hour sprint sessions.
  Powered by Anthropic's Planner-Generator-Evaluator architecture with GAN-inspired quality loops.
version: 0.1.0
authors:
  - name: Jeremy Sarda
---

# Sprint Co — 3-Hour Scrum Sprint Studio

## Mission

Sprint Co exists to collapse the gap between idea and shipped software. Given a 1–4 sentence brief, Sprint Co autonomously plans, builds, evaluates, and deploys a working product within 3 hours — no human intervention required until the final deliverable lands in your Telegram.

This is not a chatbot that writes code snippets. Sprint Co is a full autonomous software company with specialized roles, quality gates, and real deployment pipelines.

---

## The 3-Hour Sprint Methodology

Sprint Co operates on a strict 3-hour budget inspired by Anthropic's Planner-Generator-Evaluator blueprint.

### Phase Breakdown

| Phase | Duration | Owner | Output |
|-------|----------|-------|--------|
| Planning | 0:00–0:20 | Product Planner | `sprint-plan.md` |
| Architecture | 0:20–0:40 | Sprint Lead | `task-breakdown.md` |
| Implementation | 0:40–2:20 | Engineer Alpha + Beta | Feature branches |
| QA / Eval Loop | 2:20–2:45 | QA Engineer | `eval-report.md` |
| Deployment | 2:45–3:00 | Delivery Engineer | Live URL |

### Core Loop

```
Brief → Plan → Build → Evaluate → (Refine if needed) → Deploy → Report
                          ↑__________________|
                          (GAN feedback loop)
```

Each feature goes through at least one Generator → Evaluator cycle. The Evaluator is intentionally skeptical and **separate** from the Generator to prevent self-grading leniency.

### Context Reset Protocol

Agents with context anxiety (Sonnet-class) reset between phases using structured handoff artifacts. Each handoff artifact contains all the state needed to continue without prior context. Haiku-class agents are less susceptible but still produce handoff artifacts for auditability.

---

## Team Structure

### Product Team
Responsible for understanding the brief and defining what gets built.
- **Product Planner** — brief expansion, backlog creation, scope control

### Engineering Team
Responsible for building features in the sprint window.
- **Sprint Lead** — tech architecture, task routing, velocity management
- **Engineer Alpha** — full-stack generator (frontend-heavy)
- **Engineer Beta** — backend/API generator (backend-heavy)

### QA & Delivery Team
Responsible for quality gates and shipping.
- **QA Engineer** — Playwright-based evaluation, 4-criteria grading
- **Delivery Engineer** — Cloudflare deployment, smoke tests, release tagging

### Executive
- **Sprint Orchestrator** — coordinates all teams, owns the 3-hour clock, reports to Jeremy

---

## Agent Roster

| Agent | Role | Model | Heartbeat |
|-------|------|-------|-----------|
| Sprint Orchestrator | CEO / Coordinator | claude-haiku-4-5 | Every 15 min (active sprint) |
| Product Planner | Brief → Spec | claude-haiku-4-5 | On demand |
| Sprint Lead | Tech Architect | claude-haiku-4-5 | On demand |
| Engineer Alpha | Full-Stack Generator | claude-haiku-4-5 | On demand |
| Engineer Beta | Backend Generator | claude-haiku-4-5 | On demand |
| QA Engineer | Evaluator / Skeptic | claude-haiku-4-5 | On demand |
| Delivery Engineer | DevOps / Deploy | claude-haiku-4-5 | On demand |

---

## Model Strategy

**Default: `anthropic/claude-haiku-4-5`**
Fast, cheap, and capable enough for structured sprint tasks. All agents default to Haiku.

**Escalate to Sonnet when:**
- Complex architectural decisions with multiple tradeoffs
- Debugging non-obvious bugs that require deep reasoning
- Integrating unfamiliar third-party APIs with sparse docs

**Escalate to Opus when:**
- Creative or design judgment (final eval pass/fail decisions)
- Product Planner needs to make scope tradeoffs that could define the product
- QA is grading ambiguous UI quality (aesthetics vs. function)

Haiku does NOT require context resets the way Sonnet does. However, if a Haiku session exceeds ~80k tokens, generate a structured handoff artifact and start a fresh session.

---

## Heartbeat Cadence

- **Sprint Orchestrator**: Every 15 minutes during an active sprint. Checks velocity, handles blockers, updates progress.
- **All other agents**: Event-driven. Wake when assigned work. Sleep when done.
- **Between sprints**: All agents dormant. No idle heartbeats.

---

## Handoff Artifact Standard

Every phase transition must produce a structured markdown artifact. This is the single source of truth for the next agent. Format:

```markdown
# [Artifact Type] — Sprint [ID]

## Status
[READY | BLOCKED | FAILED]

## Summary
[1–3 sentence description of what was done]

## Outputs
- [list of files/URLs/artifacts produced]

## How to Test
[step-by-step test instructions]

## Known Issues
[honest list of limitations or bugs]

## Next Agent
[who picks this up and what they should do]
```

---

## Hosting

- **Paperclip Company ID**: `22266d4d-5326-4501-ad12-f181b4330d95` (JeremySarda.com account)
- **Adapter**: `claude_local` (OpenClaw-managed Claude Code token)
- **Deployment target**: Cloudflare Workers / Pages
- **Notifications**: Jeremy via Telegram
