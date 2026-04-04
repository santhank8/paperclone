# Company Roadmap Template

## Purpose

Define how Sprint Co plans across a 3-month horizon, mapping strategic goals to quarterly milestones, monthly sprint allocations, and weekly execution. The roadmap is the bridge between Board-level strategy and sprint-level tactics.

---

## Roadmap Structure

| Attribute | Value |
|-----------|-------|
| Horizon | 3 months (rolling) |
| Update cadence | Monthly |
| Owner | Orchestrator (maintaining), Board (approving) |
| Contributors | Product Planner, Stakeholder, Treasurer, Historian |
| Format | Markdown with structured tables |

---

## Roadmap Template

```markdown
---
schema: agentcompanies/v1
kind: roadmap
company: {{company-slug}}
quarter: Q{{N}} {{YEAR}}
version: {{N}}
lastUpdated: {{ISO-8601}}
---

# {{Company Name}} Roadmap — Q{{N}} {{YEAR}}

## Strategic Goals

Goals set by the Board and human stakeholders. These are the "why" behind everything Sprint Co does this quarter.

| # | Strategic Goal | Priority | OKR Alignment | Status |
|---|---------------|----------|--------------|--------|
| SG-1 | {{Goal description}} | P0 | O{{N}} | Active / Completed / Deferred |
| SG-2 | {{Goal description}} | P1 | O{{N}} | Active / Completed / Deferred |
| SG-3 | {{Goal description}} | P1 | O{{N}} | Active / Completed / Deferred |
| SG-4 | {{Goal description}} | P2 | O{{N}} | Active / Completed / Deferred |

---

## Quarterly Milestones

Major deliverables and checkpoints for the quarter.

| # | Milestone | Target Date | Strategic Goal | Success Criteria | Status |
|---|-----------|------------|---------------|-----------------|--------|
| QM-1 | {{Milestone}} | {{date}} | SG-{{N}} | {{Measurable criteria}} | 🟢 / 🟡 / 🔴 |
| QM-2 | {{Milestone}} | {{date}} | SG-{{N}} | {{Measurable criteria}} | 🟢 / 🟡 / 🔴 |
| QM-3 | {{Milestone}} | {{date}} | SG-{{N}} | {{Measurable criteria}} | 🟢 / 🟡 / 🔴 |
| QM-4 | {{Milestone}} | {{date}} | SG-{{N}} | {{Measurable criteria}} | 🟢 / 🟡 / 🔴 |

---

## Sprint Allocation

How sprints across the quarter are allocated to strategic goals.

### Monthly Sprint Budget

| Month | Total Sprints | Standard | Maintenance | Innovation | Hotfix Reserve | Calibration |
|-------|--------------|----------|-------------|-----------|---------------|-------------|
| Month 1 | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} |
| Month 2 | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} |
| Month 3 | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} | {{N}} |
| **Total** | **{{N}}** | **{{N}}** | **{{N}}** | **{{N}}** | **{{N}}** | **{{N}}** |

### Sprint-to-Goal Mapping

| Sprint Window | Sprint Type | Strategic Goal | Deliverable |
|--------------|-----------|---------------|------------|
| Week 1 | Standard | SG-1 | {{What ships}} |
| Week 1 | Standard | SG-2 | {{What ships}} |
| Week 2 | Standard | SG-1 | {{What ships}} |
| Week 2 | Maintenance | — | Tech debt reduction |
| Week 3 | Standard | SG-3 | {{What ships}} |
| Week 3 | Innovation | SG-4 | {{Exploration goal}} |
| ... | ... | ... | ... |

### Epic Mapping

For multi-sprint projects (see [Multi-Sprint Planning](multi-sprint-planning.md)):

| Epic | Strategic Goal | Sprints Allocated | Start | Target Complete |
|------|---------------|------------------|-------|----------------|
| EPIC-{{N}} | SG-{{N}} | {{N}} | {{date}} | {{date}} |
| EPIC-{{N}} | SG-{{N}} | {{N}} | {{date}} | {{date}} |

---

## Resource Plan

### Budget Per Month

| Month | Sprint Budget | Infrastructure | Shared Services | Contingency | Total |
|-------|-------------|---------------|----------------|------------|-------|
| Month 1 | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} |
| Month 2 | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} |
| Month 3 | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} | ${{N.NN}} |
| **Total** | **${{N.NN}}** | **${{N.NN}}** | **${{N.NN}}** | **${{N.NN}}** | **${{N.NN}}** |

### Model Strategy

| Model | Planned Usage | Primary Use Cases | Cost/1K Tokens |
|-------|-------------|------------------|---------------|
| Haiku | {{N%}} | Routine tasks, data gathering, simple analysis | ${{rate}} |
| Sonnet | {{N%}} | Implementation, planning, evaluation | ${{rate}} |
| Opus | {{N%}} | Architecture decisions, complex debugging, calibration | ${{rate}} |

### Model Strategy Adjustments
- If under budget: shift Haiku tasks → Sonnet for quality improvement
- If over budget: shift Sonnet tasks → Haiku where quality impact is minimal
- Opus usage reviewed monthly — reserve for highest-impact decisions

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|------|-----------|--------|-----------|-------|--------|
| R-1 | {{Risk description}} | H / M / L | H / M / L | {{Mitigation plan}} | {{agent}} | Open / Mitigated / Accepted |
| R-2 | {{Risk description}} | H / M / L | H / M / L | {{Mitigation plan}} | {{agent}} | Open / Mitigated / Accepted |
| R-3 | {{Risk description}} | H / M / L | H / M / L | {{Mitigation plan}} | {{agent}} | Open / Mitigated / Accepted |

### Common Risks for Sprint Co

| Risk | Typical Mitigation |
|------|-------------------|
| Model API outage | Fallback model configuration, grace period before pausing |
| Budget overrun | Treasurer alerts at 80%, hard stop at 95%, monthly review |
| Quality regression | Calibration sprint, QA rubric review |
| Context loss mid-epic | Historian epic summaries, structured handoff artifacts |
| External dependency failure | Circuit breaker, degraded mode fallback |

---

## Stakeholder Input

Map user needs and Board input to roadmap items.

| # | Stakeholder Need | Source | Priority | Mapped To | Status |
|---|-----------------|--------|----------|-----------|--------|
| SN-1 | {{Need description}} | Board / User / Stakeholder Agent | P0–P3 | SG-{{N}}, QM-{{N}} | Planned / In Progress / Done |
| SN-2 | {{Need description}} | Board / User / Stakeholder Agent | P0–P3 | SG-{{N}}, QM-{{N}} | Planned / In Progress / Done |
| SN-3 | {{Need description}} | Board / User / Stakeholder Agent | P0–P3 | SG-{{N}}, QM-{{N}} | Planned / In Progress / Done |

### Unaddressed Needs

Needs that didn't make this quarter's roadmap:

| Need | Reason Deferred | Earliest Quarter |
|------|----------------|-----------------|
| {{Need}} | {{Reason}} | Q{{N+1}} |

---

## Success Metrics

| Metric | Target | Measurement | Cadence |
|--------|--------|-------------|---------|
| Strategic goals on track | ≥ 80% | Goals with 🟢 status | Monthly |
| Milestone hit rate | ≥ 75% | Milestones delivered on time | Monthly |
| Sprint allocation accuracy | ≥ 85% | Sprints used as planned vs. actual | Monthly |
| Budget variance | ≤ ±15% | Planned vs. actual spend | Monthly |
| Stakeholder satisfaction | Qualitative | Board feedback | Quarterly |
```

---

## Roadmap Review Protocol

### Monthly Review

**Participants:** Orchestrator, Product Planner, Stakeholder Agent, Treasurer

**Agenda:**
1. **Progress check**: Review milestone status (10 min)
2. **Budget review**: Treasurer reports actual vs. planned (5 min)
3. **Risk update**: Review and update risk register (5 min)
4. **Adjustments**: Replan upcoming month's sprints if needed (10 min)
5. **Stakeholder input**: Incorporate new needs from Board (5 min)

**Output:** Updated roadmap document (version incremented)

### Quarterly Review

**Participants:** Board + Orchestrator + all team leads + Historian

**Agenda:**
1. **Quarter retrospective**: What was achieved vs. planned (15 min)
2. **OKR scoring**: Score and close out quarterly OKRs (10 min)
3. **Next quarter goals**: Board sets strategic goals (15 min)
4. **New roadmap**: Draft next quarter's roadmap (20 min)

**Output:** New quarterly roadmap, archived previous quarter

---

## Roadmap to Sprint Mapping

How quarterly goals translate to weekly sprint execution:

```
Strategic Goal (SG-1)
  ├── Quarterly Milestone (QM-1)
  │     ├── Epic (EPIC-001) — if multi-sprint
  │     │     ├── Sprint SP-042 — chunk 1
  │     │     ├── Sprint SP-043 — chunk 2
  │     │     └── Sprint SP-045 — chunk 3
  │     └── Sprint SP-044 — standalone task
  └── Quarterly Milestone (QM-2)
        └── Sprint SP-047 — standalone task
```

### Mapping Rules

1. Every Standard Sprint must map to at least one Strategic Goal
2. Maintenance and Calibration sprints map to O4 (Operational Excellence) by default
3. Innovation sprints map to whichever Strategic Goal the exploration supports
4. Hotfix sprints are unplanned — deducted from the relevant goal's sprint allocation
5. If a sprint can't be mapped to any goal, question whether it should happen

### Weekly Sprint Selection

The Orchestrator selects the next sprint based on:

1. **Priority**: P0 goals before P1 before P2
2. **Dependencies**: Unblocked work first
3. **Cadence**: Maintenance every 4th, Innovation every 8th, Calibration every 10th
4. **Capacity**: Budget remaining for the month
5. **Risk**: At-risk milestones get priority
