# Voice of Customer

> Single source of truth for what customers want. Living document aggregating all customer signals.

**Owner:** Stakeholder (sole writer)
**Access:** All agents can read. Only Stakeholder writes.
**Update cadence:** After every sprint
**Status:** Active

---

## Purpose

This document is the **canonical reference** for customer needs, satisfaction, and sentiment across Sprint Co. Every agent should consult this document when making decisions that affect users. It synthesizes data from:

- [Feedback Ingestion](feedback-ingestion.md) — raw feedback processing
- [Feature Prioritization](feature-prioritization.md) — what we chose to build and why
- [Customer Personas](customer-personas.md) — simulated advisory board reactions
- [Market Intelligence](market-intelligence.md) — external competitive signals

---

## Top Customer Needs (Ranked)

| Rank | Need | Evidence | Strength | Sprints Active |
|------|------|----------|----------|---------------|
| 1 | **Fast, reliable deployments** | FB-001, FB-012, FB-025; Maria & Aisha personas strongly favor; 8 feedback items in last 10 sprints | Strong | 15+ |
| 2 | **Clear, actionable error messages** | FB-003, FB-018, FB-031; Aisha persona's #1 frustration; 5 feedback items | Strong | 10+ |
| 3 | **API stability and documentation** | FB-007, FB-022; James persona's core need; 3 explicit requests | Moderate | 8 |
| 4 | **Visual dashboard for sprint metrics** | FB-010, FB-028; Tom persona's key request; 4 feedback items | Moderate | 6 |
| 5 | **Extensibility / plugin support** | FB-015, FB-033; Li Wei persona's core need; 2 requests + market trend | Growing | 4 |
| 6 | **Budget visibility and controls** | FB-020; Treasurer-validated; Maria persona values cost transparency | Emerging | 3 |
| 7 | **Quick-start onboarding (<5 min)** | FB-005, FB-014; Aisha & Maria personas; EXP-001 confirmed value | Strong | 12 |

---

## Recent Feedback Summary (Last 5 Sprints)

### Sprint S-020
- 6 feedback items: 2 BUG, 3 FEATURE, 1 IMPROVEMENT
- Key theme: Users want webhook notifications for task completion
- Urgency distribution: 1 HIGH, 3 MED, 2 LOW

### Sprint S-019
- 4 feedback items: 1 BUG, 2 FEATURE, 1 COMPLAINT
- Key theme: CLI error messages need improvement
- Urgency distribution: 2 MED, 2 LOW

### Sprint S-018
- 8 feedback items: 3 BUG, 2 FEATURE, 2 IMPROVEMENT, 1 COMPLAINT
- Key theme: Sprint velocity spike caused regressions — quality concerns
- Urgency distribution: 3 HIGH, 3 MED, 2 LOW
- **Note:** Feedback volume spike triggered Stakeholder alert to Sprint Lead

### Sprint S-017
- 3 feedback items: 1 FEATURE, 1 IMPROVEMENT, 1 COMPLAINT
- Key theme: Dashboard requested by multiple sources
- Urgency distribution: 1 MED, 2 LOW

### Sprint S-016
- 5 feedback items: 2 BUG, 2 FEATURE, 1 IMPROVEMENT
- Key theme: Deployment flow simplification
- Urgency distribution: 1 HIGH, 2 MED, 2 LOW

---

## Feature Satisfaction Map

| Feature | Satisfaction | Key Feedback | Last Updated |
|---------|:-----------:|-------------|-------------|
| Core sprint execution | ★★★★☆ | "Works well, but occasionally slow on large tasks" | S-020 |
| CLI interface | ★★★☆☆ | "Functional but error messages are cryptic" | S-019 |
| Agent orchestration | ★★★★☆ | "Impressive coordination, minor race conditions" | S-018 |
| Budget management | ★★★★★ | "Best-in-class cost controls" | S-020 |
| Documentation | ★★★☆☆ | "Good API docs, weak getting-started guide" | S-017 |
| Dashboard / UI | ★★☆☆☆ | "Needs visual polish and more charts" | S-020 |
| Onboarding flow | ★★★★☆ | "Wizard flow (post EXP-001) works great" | S-016 |
| Plugin system | ★★☆☆☆ | "Want to extend but no clear extension points yet" | S-015 |

### Satisfaction Scale
- ★★★★★ — Delighted: exceeds expectations
- ★★★★☆ — Satisfied: meets expectations, minor issues
- ★★★☆☆ — Neutral: functional but room for improvement
- ★★☆☆☆ — Dissatisfied: significant gaps or pain points
- ★☆☆☆☆ — Frustrated: fundamentally broken or missing

---

## Unmet Needs

Capabilities customers want that Sprint Co hasn't built yet:

| Need | Source | Persona Demand | Priority Score | Blocker |
|------|--------|---------------|---------------|---------|
| Webhook/event notifications | FB-001, FB-025 | Maria (HIGH), James (HIGH) | 24.0 | None — ready to build |
| Export sprint reports (PDF/PNG) | FB-010, FB-028 | Tom (HIGH) | 8.0 | Low priority vs. other needs |
| Custom agent adapters (user-defined) | FB-015, FB-033 | Li Wei (HIGH) | 12.0 | Architecture work needed |
| Mobile-friendly dashboard | FB-030 | Maria (MED), Aisha (MED) | 6.0 | Effort is XL |
| Multi-company management | Market signal | James (HIGH) | 18.0 | Spec not finalized |
| Offline/local-first mode | Market trend | Aisha (MED), Li Wei (MED) | 10.0 | Architecture decision pending |

---

## Customer Sentiment Trend

| Period | Sentiment | Direction | Signal |
|--------|-----------|-----------|--------|
| S-016 to S-020 | **Positive** | ↗ Improving | Bug count declining, feature satisfaction rising, fewer complaints |
| S-011 to S-015 | **Neutral** | → Stable | Steady feedback volume, mixed satisfaction scores |
| S-006 to S-010 | **Negative** | ↘ Declining | High bug rate, onboarding complaints, quality concerns |

### Current Assessment: **Improving**

**Positive signals:**
- Bug reports trending down (5 → 3 → 2 over last 3 sprints)
- Feature request quality improving (more specific, less frustrated)
- Onboarding satisfaction jumped after EXP-001 wizard flow shipped
- Budget management consistently rated 5-star

**Watch items:**
- Dashboard satisfaction still low — unaddressed for 5+ sprints
- Plugin system demand growing but no timeline committed
- Quality regression in S-018 briefly spiked complaints

---

## Persona Alignment Check

| Persona | Alignment | Status | Notes |
|---------|:---------:|--------|-------|
| **Maria Chen** (Startup Founder) | ★★★★☆ | Well-served | Fast deploys and budget controls hit her needs. CLI DX could improve. |
| **James Rodriguez** (Enterprise IT) | ★★★☆☆ | Partially served | API docs are good. Missing audit logs and strict versioning. |
| **Aisha Patel** (Solo Developer) | ★★★☆☆ | Partially served | Onboarding improved. Error messages still a pain point. |
| **Tom Anderson** (Product Manager) | ★★☆☆☆ | Underserved | Dashboard and visual features lag behind his needs. |
| **Li Wei** (OSS Maintainer) | ★★☆☆☆ | Underserved | Code quality is good but extensibility/plugin system isn't there yet. |

### Action Items
- **Priority:** Improve service to Tom and Li Wei in next 5 sprints
- **How:** Dashboard improvements (Tom), plugin architecture research (Li Wei)
- **Track:** Revisit persona alignment in S-025

---

## Document History

| Sprint | Major Changes |
|--------|-------------|
| S-020 | Initial creation of Voice of Customer document |
| — | Updated after each subsequent sprint |
