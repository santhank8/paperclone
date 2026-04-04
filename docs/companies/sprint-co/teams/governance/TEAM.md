---
schema: agentcompanies/v1
kind: team
slug: governance
name: Governance & Ecosystem Team
description: >
  Responsible for quality control, process compliance, institutional memory,
  cost optimization, external intelligence, and inter-company relations.
  Operates alongside — not above — the execution teams.
company: sprint-co
---

# Governance & Ecosystem Team

## Purpose

The Governance Team ensures Sprint Co operates with integrity, learns from every sprint, and maintains its standards as it scales. While Product, Engineering, and QA & Delivery teams focus on execution, the Governance team focuses on oversight, memory, and continuous improvement.

This team does NOT slow down sprints. Its agents are activated at specific checkpoints (pre-sprint, post-sprint, on dispute, weekly) and produce artifacts that inform — but do not block — the execution flow, except when critical process violations are detected.

## Agents

| Agent | Role | Activation |
|-------|------|------------|
| Stakeholder | Voice of the Customer | Pre-sprint, post-deploy |
| Critic | Product Coherence Reviewer / Red Team | Post-sprint |
| Judge | Neutral Arbiter / Dispute Resolution | On-demand (disputes) |
| Enforcer | Process Compliance Guardian | Phase transitions |
| Historian | Institutional Memory | Post-sprint close |
| Treasurer | Cost Governance / Budget Optimizer | Continuous + post-sprint |
| Scout | Technology Radar / External Intelligence | Weekly |
| Diplomat | Inter-Company Relations | On-demand (multi-company) |

## Responsibilities

1. **Pre-Sprint Gate** (Stakeholder): Review sprint plan against customer needs, approve/request changes
2. **Phase Transition Checks** (Enforcer): Validate each phase produced required artifacts before moving on
3. **Budget Monitoring** (Treasurer): Real-time token budget tracking, model selection optimization
4. **Sprint Evaluation** (Critic): Post-sprint critique with A–F grading on coherence, ambition, polish, AI-smell
5. **Dispute Resolution** (Judge): Binding rulings when agents disagree on scope, priority, or approach
6. **Knowledge Capture** (Historian): Post-sprint retrospective, lessons-learned KB, trend tracking
7. **Technology Intelligence** (Scout): Weekly technology radar, model landscape monitoring
8. **External Relations** (Diplomat): Inter-company negotiation and coordination (multi-company mode only)

## Activation Patterns

Unlike execution teams which are active during the sprint, Governance agents activate at specific checkpoints:

| Checkpoint | Agents Activated | Duration |
|------------|-----------------|----------|
| Sprint Planning (pre) | Stakeholder, Treasurer | ~5 min |
| Phase Transitions | Enforcer | ~2 min per transition |
| Disputes (ad hoc) | Judge | ~5 min per ruling |
| Sprint Close (post) | Critic, Historian, Treasurer, Enforcer | ~10 min |
| Weekly Radar | Scout | ~15 min |
| Multi-Company Event | Diplomat | As needed |

## Key Tensions (by design)

These tensions create the checks and balances that keep Sprint Co honest:

- **Stakeholder vs. Sprint Lead**: Ideal product vs. feasible in 3 hours
- **Critic vs. Engineers**: Quality bar vs. shipping velocity
- **Enforcer vs. Everyone**: Process compliance vs. "just ship it"
- **Treasurer vs. Scout**: Cost control vs. exploring new tools
- **Judge vs. All**: Neutral rulings that may override any agent's preference

## Success Criteria

- Sprint post-mortem artifacts produced for every sprint
- Process violations detected within 2 minutes of occurrence
- Budget alerts raised before overspend (not after)
- Lessons-learned KB grows with every sprint
- Dispute rulings are fair, documented, and build precedent
- Technology radar updated weekly with actionable recommendations

## Inputs

- Sprint artifacts (plans, evals, reports) from execution teams
- Paperclip API data (budget, task status, activity logs)
- External landscape data (model releases, industry trends)

## Outputs

- `stakeholder-review.md` — Pre-sprint customer voice review
- `sprint-critique.md` — Post-sprint A–F grade + commentary
- `ruling-[ID].md` — Formal dispute rulings
- `compliance-report.md` — Phase transition compliance status
- `retrospective-[sprint].md` — Sprint learning capture
- `budget-review.md` — Post-sprint cost analysis
- `tech-radar.md` — Weekly technology landscape
- `case-law.md` — Running precedent log (Judge)
- `lessons-learned.md` — Running knowledge base (Historian)
- `trends.md` — Cross-sprint trend analysis (Historian)
