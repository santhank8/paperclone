# Multi-Sprint Planning

## Purpose

Define protocols for managing projects that span 5–20 sprints — Epics too large for a single 3-hour session but with a clear end state.

---

## Epic Definition

An **Epic** is a goal too large to complete in a single sprint. Epics are decomposed into sprint-sized chunks with explicit dependencies and milestones.

| Property | Description |
|----------|-------------|
| **Scope** | Multiple sprints (5–20) |
| **Owner** | Product Planner (planning), Orchestrator (execution) |
| **Input** | Strategic goal from Board or Stakeholder |
| **Output** | Fully delivered capability across multiple sprints |
| **Quality** | Each sprint produces a shippable increment; the Epic is done when all milestones are met |

---

## Epic Planning Protocol

**Participants:** Product Planner + Stakeholder (primary), Orchestrator + Sprint Lead (advisory)

### Phase 1: Decomposition

The Product Planner and Stakeholder decompose the Epic into sprint-sized chunks:

1. **Define the Epic objective** — Single paragraph describing the end state
2. **Identify major deliverables** — Concrete outputs that compose the Epic
3. **Break into sprint tasks** — Each sprint should produce a standalone shippable increment
4. **Map dependencies** — Which sprints must complete before others can start

### Phase 2: Sequencing

Produce an ordered sprint sequence:

```
Epic: "Build a full-stack SaaS product"

Sprint 1: API scaffold + auth           [No dependencies]
Sprint 2: Core data models + CRUD       [Depends on: Sprint 1]
Sprint 3: Frontend shell + routing      [No dependencies]
Sprint 4: API integration + frontend    [Depends on: Sprint 2, Sprint 3]
Sprint 5: Payment integration           [Depends on: Sprint 4]
Sprint 6: Admin dashboard               [Depends on: Sprint 2]
Sprint 7: End-to-end testing + polish   [Depends on: Sprint 4, Sprint 5, Sprint 6]
Sprint 8: Production deployment + docs  [Depends on: Sprint 7]
```

### Phase 3: Milestone Definition

Group sprints into milestones — checkpoints where the Epic produces demonstrable value:

| Milestone | After Sprint | Deliverable | Verification |
|-----------|-------------|-------------|--------------|
| M1: Backend Ready | Sprint 2 | Working API with auth and data models | API smoke tests pass |
| M2: Full Stack MVP | Sprint 4 | Connected frontend + backend | End-to-end happy path works |
| M3: Feature Complete | Sprint 6 | All features implemented | Feature acceptance criteria met |
| M4: Ship | Sprint 8 | Production deployment | Live URL, docs, monitoring |

---

## Epic Tracking Template

```yaml
epic:
  id: EPIC-{{SEQ}}
  title: "Epic Title"
  objective: "One-paragraph description of the end state"
  owner: product-planner
  status: planning | in-progress | blocked | completed | cancelled

  planning:
    total_sprints_planned: 8
    sprints_completed: 0
    progress_percent: 0
    estimated_total_cost: "$120.00"
    actual_cost_to_date: "$0.00"

  milestones:
    - id: M1
      name: "Backend Ready"
      target_sprint: SP-002
      status: pending | achieved | missed
      achieved_date: null
    - id: M2
      name: "Full Stack MVP"
      target_sprint: SP-004
      status: pending
      achieved_date: null

  sprints:
    - sprint_id: SP-001
      objective: "API scaffold + auth"
      depends_on: []
      status: planned | in-progress | completed | failed
      actual_cost: null
    - sprint_id: SP-002
      objective: "Core data models + CRUD"
      depends_on: [SP-001]
      status: planned
      actual_cost: null

  risk_flags:
    - flag: "Payment provider API may have rate limits"
      severity: medium
      mitigation: "Test in Sprint 4, pivot to alternative if blocked"
    - flag: "Sprint 6 scope may be too large for 3 hours"
      severity: low
      mitigation: "Split admin dashboard across two sprints if needed"

  created: "{{ISO-8601}}"
  last_updated: "{{ISO-8601}}"
```

### Epic Tracking Table

| Epic ID | Title | Sprints Planned | Sprints Done | Progress | Next Milestone | Risk Flags | Status |
|---------|-------|----------------|-------------|----------|---------------|------------|--------|
| EPIC-001 | [Title] | [N] | [N] | [N%] | [Milestone] | [Count] | [Status] |
| EPIC-002 | [Title] | [N] | [N] | [N%] | [Milestone] | [Count] | [Status] |

---

## Cross-Sprint Dependencies

### Dependency Types

| Type | Description | Example |
|------|-------------|---------|
| **Hard Dependency** | Sprint B cannot start until Sprint A completes | Frontend integration needs API |
| **Soft Dependency** | Sprint B benefits from Sprint A but can proceed with stubs | Admin dashboard can use mock data |
| **External Dependency** | Sprint depends on something outside the Epic | Third-party API approval |

### Dependency Graph

Visualize dependencies to identify the critical path:

```
[Sprint 1] ──→ [Sprint 2] ──→ [Sprint 4] ──→ [Sprint 5] ──→ [Sprint 7] ──→ [Sprint 8]
                                   ↑                              ↑
[Sprint 3] ────────────────────────┘           [Sprint 6] ───────┘
```

**Critical Path:** Sprint 1 → 2 → 4 → 5 → 7 → 8 (6 sprints)

### Handling Blocked Dependencies

| Situation | Action |
|-----------|--------|
| Hard dependency sprint fails | Trigger remediation sprint before continuing |
| Soft dependency delayed | Proceed with stubs, reconcile when dependency completes |
| External dependency blocked | Escalate to Stakeholder, resequence if possible |
| Dependency scope creep | Product Planner reassesses — may add sprints |

---

## Epic Retrospective

After Epic completion, the Historian produces a comprehensive retrospective.

### Retrospective Template

```yaml
epic_retrospective:
  epic_id: EPIC-{{SEQ}}
  title: "Epic Title"
  historian: historian

  summary:
    planned_sprints: 8
    actual_sprints: 9
    planned_cost: "$120.00"
    actual_cost: "$132.50"
    milestones_hit_on_time: 3
    milestones_missed: 1
    overall_assessment: "Delivered with minor delays — one sprint added for payment integration complexity"

  what_went_well:
    - "Backend sprints (1-2) were estimated accurately"
    - "Cross-sprint handoffs preserved context effectively"
    - "QA scores improved sprint-over-sprint"

  what_could_improve:
    - "Payment integration underestimated — should have been two sprints"
    - "Sprint 6 (admin dashboard) was overloaded"
    - "External dependency on payment API caused a 2-day block"

  lessons_learned:
    - id: LL-{{SEQ}}
      insight: "Third-party integrations should be estimated at 1.5x internal work"
      applicable_to: "Future Epics with external dependencies"
    - id: LL-{{SEQ}}
      insight: "Admin/dashboard sprints should cap at 3 pages per sprint"
      applicable_to: "Future UI-heavy Epics"

  recommendations:
    - "Add a 'dependency validation' sprint for Epics with external APIs"
    - "Allocate 15% buffer sprints for Epics longer than 6 sprints"

  knowledge_base_entries_created:
    - LL-045
    - LL-046
```

### Retrospective Process

1. Historian gathers all sprint eval reports, cost data, and milestone tracking
2. Historian produces retrospective within one sprint of Epic completion
3. Orchestrator reviews and distributes to all agents
4. Lessons learned entries added to company KB
5. Recommendations fed into next Epic's planning phase
