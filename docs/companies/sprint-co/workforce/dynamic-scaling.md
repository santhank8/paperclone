# Dynamic Scaling Protocol

> Phase 6 — Adaptive Workforce & Dynamic Teams

Sprint Co operates with a core team of 15 agents. This protocol governs when and how to temporarily expand or contract that workforce to match sprint demands.

---

## When to Scale Up

| Trigger | Detection Method | Decision Owner |
|---------|-----------------|----------------|
| Large sprint scope (>20 story points) | Planner flags during sprint planning | Sprint Lead |
| Parallel workstreams > 2 | Orchestrator detects task graph parallelism | Orchestrator |
| Specialized skill needed (e.g., security audit) | Scout identifies skill gap in research phase | Scout |
| Repeated deadline misses | Historian trend analysis over 3+ sprints | Judge |
| Critical-path bottleneck | Sprint Lead identifies blocked dependency chain | Sprint Lead |

## When to Scale Down

| Trigger | Detection Method | Decision Owner |
|---------|-----------------|----------------|
| Light sprint (<8 story points) | Planner scope assessment | Sprint Lead |
| Budget approaching threshold (>80% consumed) | Treasurer real-time monitoring | Treasurer |
| Idle agents (no tasks for >2 cycles) | Orchestrator task queue analysis | Orchestrator |
| Post-launch maintenance phase | Planner classifies sprint type | Sprint Lead |

---

## Scaling Decision Matrix

| Sprint Scope | Story Points | Recommended Engineers | Recommended QA | Model Budget Multiplier |
|-------------|-------------|----------------------|----------------|------------------------|
| **Small** | 1–8 | 1 (Alpha) | Shared with engineer | 1.0× (baseline) |
| **Medium** | 9–20 | 2 (Alpha + Beta) | 1 (QA Lead) | 1.0× |
| **Large** | 21–35 | 3 (Alpha + Beta + Temp-1) | 1–2 | 1.4× |
| **Epic** | 36+ | 4+ (Alpha + Beta + Temp-1 + Temp-2) | 2 | 1.8× |

### Budget Projections

| Scale Level | Additional Agents | Est. Token Cost/Sprint | Notes |
|------------|-------------------|----------------------|-------|
| Baseline (Medium) | 0 | $0.00 extra | Normal operations |
| Large (+1 eng) | 1 | +$2.50–$5.00 | Haiku-tier temp agent |
| Epic (+2 eng, +1 QA) | 3 | +$8.00–$15.00 | Mixed Haiku/Sonnet |
| Surge (+3 eng, +1 QA, +1 specialist) | 5 | +$18.00–$30.00 | Includes Sonnet specialist |

---

## How to Add a Temporary Agent

### Onboarding Checklist

```
[ ] 1. Assign slug
       Format: temp-{role}-{number} (e.g., temp-engineer-1)
       Register in company manifest

[ ] 2. Configure model
       Default: claude-haiku (cost-efficient for known-pattern tasks)
       Escalation: claude-sonnet (if task complexity score ≥ 9)

[ ] 3. Provide context package
       Required reading:
         - COMPANY.md
         - Relevant TEAM.md
         - Current sprint brief
         - Active task specifications
         - lessons-learned.md (last 3 entries)

[ ] 4. Assign initial tasks
       First task MUST be supervised (output reviewed by Sprint Lead)
       No unsupervised work until trust level ≥ 1

[ ] 5. Set trust level
       Initial trust: 0 (all outputs require review)
       Promotion to trust 1: after 3 successful supervised tasks
       Promotion to trust 2: not available for temp agents

[ ] 6. Assign mentor
       Pair with Alpha or Beta for first task cycle
       Mentor reviews outputs and provides correction

[ ] 7. Register with Treasurer
       Budget allocation tagged to temp agent slug
       Spending alerts at 50%, 80%, 100% of allocation
```

### Temporary Agent Constraints

- **Max duration**: 1 sprint (can be renewed once with Judge approval)
- **Max trust level**: 1 (supervised execution only)
- **No governance access**: Cannot vote, approve, or modify constitution
- **Scoped context**: Only receives context relevant to assigned tasks

---

## How to Remove a Temporary Agent

### Graceful Wind-Down Protocol

```
Step 1: Sprint Lead marks agent as "winding down"
        No new tasks assigned

Step 2: Complete or hand off in-progress work
        If task is >70% complete → agent finishes
        If task is <70% complete → hand off to Alpha or Beta
        Handoff includes: progress summary, open questions, file locations

Step 3: Knowledge capture
        Historian extracts:
          - Task outcomes and quality scores
          - Any novel approaches or solutions discovered
          - Failure modes encountered
          - Recommendations for future similar tasks

Step 4: Budget reconciliation
        Treasurer records final token usage
        Compare actual vs. projected cost

Step 5: Deregister
        Remove from company manifest
        Archive agent context and outputs
        Sprint Lead confirms removal in retrospective
```

---

## Cost Impact Projections

### Per-Sprint Cost Model

```
Base team (15 agents):
  Governance (4 agents, mostly Sonnet)     ≈ $3.00–$5.00
  Product (3 agents, mixed)                ≈ $2.00–$4.00
  Engineering (4 agents, mixed)            ≈ $4.00–$8.00
  QA & Delivery (4 agents, mixed)          ≈ $2.00–$4.00
  ─────────────────────────────────────────────────────
  Total baseline                           ≈ $11.00–$21.00

Scaling costs:
  +1 Haiku engineer                        ≈ +$1.50–$3.00
  +1 Sonnet engineer                       ≈ +$4.00–$7.00
  +1 Haiku QA                              ≈ +$1.00–$2.00
  +1 Sonnet specialist (consultant)        ≈ +$5.00–$10.00
```

### ROI Justification

Scaling up is justified when:
- **Deadline risk** exceeds cost of additional agent
- **Parallelism gain** reduces calendar time by ≥30%
- **Specialist knowledge** prevents rework that would cost more than consultant fee

Scaling down is justified when:
- **Idle cost** of maintaining agent exceeds value of availability
- **Budget runway** needs preservation for future sprints
