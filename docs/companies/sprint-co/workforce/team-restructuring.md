# Team Restructuring Protocol

> Phase 6 — Adaptive Workforce & Dynamic Teams

Defines when and how to reorganize Sprint Co's team structure in response to changing needs.

---

## Restructuring Triggers

| Trigger | Detection Method | Threshold |
|---------|-----------------|-----------|
| Persistent underperformance | Historian tracks team metrics over 5+ sprints | Team velocity drops >25% for 3 consecutive sprints |
| Growing company complexity | Planner identifies expanding scope beyond current structure | >30% of tasks require cross-team coordination |
| New capability needs | Scout identifies recurring skill gaps | Same specialist consultant engaged 3+ sprints |
| Repeated escalations in one area | Judge logs escalation patterns | >5 escalations from same domain per sprint |
| Team overload | Sprint Lead reports capacity issues | Team consistently at >90% capacity with growing queue |
| Team underutilization | Orchestrator detects idle agents | Team at <40% capacity for 3+ sprints |

### Trigger Evaluation

A single trigger initiates **discussion only**. Restructuring requires:
- At least 2 triggers active simultaneously, OR
- 1 critical trigger persisting for 5+ sprints

---

## Proposal Process

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Historian Analyzes Data                              │
│   - Compiles metrics for affected teams (5-sprint window)    │
│   - Identifies patterns in task distribution and success     │
│   - Documents trigger evidence                               │
│   - Produces "Restructuring Analysis Report"                 │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Historian Proposes Restructuring                     │
│   - Selects restructuring option (see options below)         │
│   - Drafts impact assessment                                 │
│   - Defines transition plan                                  │
│   - Estimates cost and timeline                              │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 3: Stakeholder Reviews User Impact                      │
│   - Assesses how changes affect external deliverables        │
│   - Identifies risks to in-flight work                       │
│   - Flags user-facing disruption potential                   │
│   - Recommends timing (between sprints preferred)            │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Judge Rules on Proposal                              │
│   - Reviews analysis, proposal, and stakeholder assessment   │
│   - Evaluates against constitution principles                │
│   - Issues binding ruling: approve / modify / reject         │
│   - If approved: sets implementation conditions              │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Step 5: Board Approves                                       │
│   - Final human oversight and approval                       │
│   - May add conditions or modifications                      │
│   - Sets effective date                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Restructuring Options

### Option A: Split Team

**When**: A team has grown too large or handles too many distinct domains.

```
Before:                          After:
┌─────────────────────┐         ┌──────────────┐  ┌──────────────┐
│ Engineering (4)     │    →    │ Eng-Backend  │  │ Eng-Frontend │
│ Sprint Lead, Alpha, │         │ (3)          │  │ (2)          │
│ Beta, Orchestrator  │         └──────────────┘  └──────────────┘
└─────────────────────┘

Considerations:
  - Each sub-team needs a lead (promote or assign)
  - Cross-team interfaces must be defined
  - Orchestrator may need to coordinate between sub-teams
```

### Option B: Merge Teams

**When**: Two teams have overlapping responsibilities or one is underutilized.

```
Before:                          After:
┌────────────┐ ┌────────────┐   ┌─────────────────────┐
│ QA (2)     │ │ Delivery(2)│ → │ QA & Delivery (4)   │
└────────────┘ └────────────┘   └─────────────────────┘

Considerations:
  - Unified leadership (select or appoint team lead)
  - Reconcile conflicting workflows
  - Reassign tasks that were cross-team to single-team ownership
```

### Option C: Create New Team

**When**: A new capability area needs dedicated focus.

```
Before:                          After:
(no DevOps team)          →     ┌──────────────────┐
                                │ Platform (2–3)   │
                                │ DevOps Lead      │
                                │ + 1–2 engineers  │
                                └──────────────────┘

Considerations:
  - Define team charter (TEAM.md)
  - Create AGENTS.md for new roles
  - Source agents (promote internal or add new via dynamic-scaling.md)
  - Define interfaces with existing teams
```

### Option D: Reassign Agents

**When**: Individual agents are mismatched to their current team.

```
Example:
  Beta (currently Engineering) → move to QA & Delivery
  Reason: Beta's highest competency scores are in testing (5/5)
          and documentation (5/5), not complex engineering (2/5)

Considerations:
  - Agent re-reads new TEAM.md and AGENTS.md
  - Abbreviated training pipeline (skip context they already know)
  - Update specialization profiles
  - 1-sprint adjustment period with extra supervision
```

### Option E: Change Reporting Lines

**When**: Coordination patterns don't match organizational structure.

```
Example:
  Orchestrator reports to Engineering → moves to Product
  Reason: Orchestrator's primary interactions are with Planner
          and Sprint Lead, not individual engineers

Considerations:
  - Update TEAM.md for both teams
  - No role change, just organizational alignment
  - Minimal disruption to workflows
```

---

## Impact Assessment Template

Complete this template for every restructuring proposal:

```markdown
## Impact Assessment: [Proposal Name]

### Date: YYYY-MM-DD
### Proposed By: [Historian]
### Restructuring Type: [Split / Merge / New Team / Reassign / Reporting Change]

### Current State
- Teams affected: [list]
- Agents affected: [list with current roles]
- Current performance metrics:
  - Team velocity: ___
  - Task success rate: ___%
  - Escalation rate: ___/sprint
  - Cross-team coordination overhead: ___%

### Proposed State
- New team structure: [describe]
- Agent assignments: [list with new roles]
- Expected improvements:
  - Velocity: +/- ___%
  - Task success: +/- ___%
  - Escalation reduction: ___%

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
|      |            |        |            |

### Cost Impact
- One-time transition cost: $___
- Ongoing cost change: +/- $___/sprint
- ROI timeline: ___ sprints

### Dependencies
- In-flight work that must complete first: [list]
- External dependencies: [list]
- Required approvals: [list]

### Recommendation
[Proceed / Proceed with conditions / Defer / Reject]
```

---

## Transition Plan Template

```markdown
## Transition Plan: [Proposal Name]

### Timeline
| Phase | Duration | Activities |
|-------|----------|------------|
| Preparation | 1 sprint | Document changes, update TEAM/AGENTS files |
| Transition | 1 sprint | Execute moves, run abbreviated training |
| Stabilization | 2 sprints | Monitor, extra supervision, adjust |

### Pre-Transition
- [ ] All in-flight tasks completed or safely handed off
- [ ] Updated TEAM.md files drafted for affected teams
- [ ] Updated AGENTS.md files drafted for affected agents
- [ ] Knowledge transfer sessions scheduled
- [ ] Rollback plan documented

### During Transition
- [ ] Agents re-read new role documents
- [ ] Abbreviated training pipeline for agents changing roles
- [ ] Sprint Lead monitors for confusion or blockers
- [ ] Daily check-ins during first week

### Post-Transition
- [ ] All agents confirmed operational in new structure
- [ ] Specialization profiles updated
- [ ] Historian begins tracking new-structure metrics
- [ ] First retrospective covers transition experience

### Rollback Plan
If within 2 sprints the new structure shows:
  - Velocity drops >15% vs. pre-restructuring baseline
  - Task failure rate increases >10 percentage points
  - Multiple agents report persistent confusion

Then:
  1. Sprint Lead files rollback request
  2. Judge reviews evidence
  3. If approved: revert to previous structure
  4. Historian documents what went wrong and why
```

---

## Post-Restructuring Evaluation

Historian tracks outcomes for 5 sprints after any restructuring:

### Metrics Dashboard

| Metric | Pre-Change (avg 5 sprints) | Sprint +1 | Sprint +2 | Sprint +3 | Sprint +4 | Sprint +5 | Trend |
|--------|:--------------------------:|:---------:|:---------:|:---------:|:---------:|:---------:|:-----:|
| Team velocity | | | | | | | |
| Task success rate | | | | | | | |
| Escalation count | | | | | | | |
| Cross-team coordination overhead | | | | | | | |
| Agent satisfaction (self-reported) | | | | | | | |
| Budget variance | | | | | | | |
| Queue depth (pending tasks) | | | | | | | |

### Evaluation Gates

| Sprint | Evaluation |
|:------:|------------|
| +1 | **Stabilization check**: Are agents operational? Any blockers? |
| +2 | **Early signal**: Direction of metrics (improving, stable, degrading) |
| +3 | **Midpoint review**: Formal assessment — continue, adjust, or rollback? |
| +4 | **Confirmation**: Metrics should show improvement or stability |
| +5 | **Final evaluation**: Historian produces restructuring outcome report |

### Outcome Report Structure

```markdown
## Restructuring Outcome Report

### Restructuring: [name]
### Period: Sprint X → Sprint X+5
### Evaluator: Historian

### Summary
[1-paragraph summary of what changed and overall outcome]

### Metrics Comparison
[Table comparing pre/post metrics]

### What Worked
- [bullet points]

### What Didn't Work
- [bullet points]

### Lessons Learned
- [bullet points — added to lessons-learned.md]

### Recommendation
[ ] Structure is working — maintain
[ ] Structure needs minor adjustment — specify
[ ] Structure should be reverted — explain
```
