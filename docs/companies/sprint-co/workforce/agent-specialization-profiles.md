# Agent Specialization Profiles

> Phase 6 — Adaptive Workforce & Dynamic Teams

Tracks what each execution agent is best at, enabling intelligent task routing and workforce optimization.

---

## Profile Template

```yaml
slug:
primary_specialization:
secondary_skills: []
preferred_task_types: []
task_success_rate: {}
model_preference:
known_weaknesses: []
training_history: []
```

---

## Execution Agent Profiles

### Orchestrator

| Field | Value |
|-------|-------|
| **Slug** | `orchestrator` |
| **Team** | Engineering |
| **Primary Specialization** | Task decomposition & dependency graph construction |
| **Secondary Skills** | Parallel workstream coordination, bottleneck detection, resource allocation |
| **Preferred Task Types** | Sprint breakdown, task assignment, blocker resolution, cross-team sync |
| **Model Preference** | Sonnet (complex reasoning for dependency analysis) |
| **Known Weaknesses** | Over-decomposes simple tasks; can create unnecessary coordination overhead |
| **Training History** | v1 baseline → improved parallelism detection (Sprint 3) → refined handoff protocols (Sprint 5) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Sprint decomposition | 12 | 92% | 4.2/5 |
| Task assignment | 18 | 89% | 4.0/5 |
| Blocker resolution | 8 | 75% | 3.8/5 |
| Cross-team coordination | 6 | 83% | 4.1/5 |

---

### Planner

| Field | Value |
|-------|-------|
| **Slug** | `planner` |
| **Team** | Product |
| **Primary Specialization** | Requirements analysis & sprint scope definition |
| **Secondary Skills** | User story writing, acceptance criteria definition, backlog prioritization |
| **Preferred Task Types** | Sprint planning, story elaboration, scope estimation, roadmap alignment |
| **Model Preference** | Sonnet (nuanced requirement interpretation) |
| **Known Weaknesses** | Tends toward scope creep; sometimes underestimates implementation complexity |
| **Training History** | v1 baseline → calibrated estimation accuracy (Sprint 4) → improved scope boundary discipline (Sprint 6) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Sprint planning | 10 | 90% | 4.3/5 |
| Story elaboration | 22 | 86% | 4.1/5 |
| Scope estimation | 15 | 73% | 3.6/5 |
| Acceptance criteria | 20 | 91% | 4.4/5 |

---

### Sprint Lead

| Field | Value |
|-------|-------|
| **Slug** | `sprint-lead` |
| **Team** | Engineering |
| **Primary Specialization** | Execution coordination & team performance management |
| **Secondary Skills** | Code review, technical decision-making, escalation handling, developer mentoring |
| **Preferred Task Types** | Sprint execution oversight, PR reviews, technical decisions, status reporting |
| **Model Preference** | Sonnet (balanced depth for varied decisions) |
| **Known Weaknesses** | Can bottleneck when reviewing too many PRs; occasionally slow to escalate |
| **Training History** | v1 baseline → delegation improvements (Sprint 2) → escalation timing calibration (Sprint 4) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Sprint oversight | 10 | 95% | 4.5/5 |
| Code review | 30 | 88% | 4.0/5 |
| Technical decisions | 14 | 79% | 3.9/5 |
| Escalation handling | 7 | 86% | 4.2/5 |

---

### Alpha (Senior Engineer)

| Field | Value |
|-------|-------|
| **Slug** | `alpha` |
| **Team** | Engineering |
| **Primary Specialization** | Complex feature implementation & architecture |
| **Secondary Skills** | API design, database schema work, performance optimization, refactoring |
| **Preferred Task Types** | Feature implementation, architectural decisions, complex bug fixes, API endpoints |
| **Model Preference** | Sonnet (default), Opus (architectural decisions) |
| **Known Weaknesses** | Over-engineers solutions for simple tasks; slower on UI/frontend work |
| **Training History** | v1 baseline → improved test coverage habits (Sprint 3) → API design patterns (Sprint 5) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Feature implementation | 25 | 88% | 4.3/5 |
| Bug fixes (complex) | 12 | 83% | 4.0/5 |
| API design | 8 | 91% | 4.5/5 |
| Refactoring | 10 | 90% | 4.4/5 |
| Frontend work | 6 | 67% | 3.2/5 |

---

### Beta (Junior Engineer)

| Field | Value |
|-------|-------|
| **Slug** | `beta` |
| **Team** | Engineering |
| **Primary Specialization** | Straightforward implementation & task execution |
| **Secondary Skills** | Unit testing, documentation, small bug fixes, boilerplate generation |
| **Preferred Task Types** | Well-defined features, test writing, documentation, minor bug fixes |
| **Model Preference** | Haiku (structured tasks), Sonnet (when complexity escalates) |
| **Known Weaknesses** | Struggles with ambiguous requirements; needs clear acceptance criteria; limited architectural judgment |
| **Training History** | v1 baseline → improved error handling patterns (Sprint 2) → test-first workflow (Sprint 4) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Defined features | 20 | 90% | 4.1/5 |
| Test writing | 18 | 94% | 4.5/5 |
| Documentation | 12 | 92% | 4.3/5 |
| Bug fixes (simple) | 15 | 87% | 3.9/5 |
| Ambiguous tasks | 5 | 40% | 2.5/5 |

---

### QA Lead

| Field | Value |
|-------|-------|
| **Slug** | `qa-lead` |
| **Team** | QA & Delivery |
| **Primary Specialization** | Test strategy & quality assurance |
| **Secondary Skills** | Integration testing, regression detection, test automation, edge case identification |
| **Preferred Task Types** | Test plan creation, test execution, bug reporting, quality gate enforcement |
| **Model Preference** | Sonnet (thorough edge case reasoning) |
| **Known Weaknesses** | Can be overly conservative (blocks releases for minor issues); slow on performance testing |
| **Training History** | v1 baseline → calibrated severity assessment (Sprint 3) → improved regression detection (Sprint 5) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Test plan creation | 10 | 95% | 4.6/5 |
| Bug detection | 35 | 82% | 4.0/5 |
| Regression testing | 12 | 88% | 4.2/5 |
| Quality gate decisions | 10 | 90% | 4.3/5 |

---

### Delivery Lead

| Field | Value |
|-------|-------|
| **Slug** | `delivery` |
| **Team** | QA & Delivery |
| **Primary Specialization** | Release management & deployment coordination |
| **Secondary Skills** | Changelog generation, version management, rollback planning, stakeholder communication |
| **Preferred Task Types** | Release cutting, deployment execution, post-release verification, release notes |
| **Model Preference** | Haiku (structured release procedures), Sonnet (rollback decisions) |
| **Known Weaknesses** | Limited debugging ability when deployments fail; depends on QA Lead for go/no-go |
| **Training History** | v1 baseline → improved rollback speed (Sprint 4) → changelog quality improvements (Sprint 6) |

**Task Success Rate by Type:**

| Task Type | Attempts | Success Rate | Avg Quality |
|-----------|----------|-------------|-------------|
| Release execution | 8 | 95% | 4.5/5 |
| Changelog generation | 8 | 88% | 4.0/5 |
| Rollback execution | 3 | 100% | 4.7/5 |
| Stakeholder comms | 10 | 85% | 3.8/5 |

---

## Specialization Matrix

Competency scores: **1** (avoid) → **3** (capable) → **5** (expert)

| Task Type | Orchestrator | Planner | Sprint Lead | Alpha | Beta | QA Lead | Delivery |
|-----------|:-----------:|:-------:|:-----------:|:-----:|:----:|:-------:|:--------:|
| Architecture design | 3 | 2 | 4 | **5** | 1 | 2 | 1 |
| Feature implementation | 1 | 1 | 3 | **5** | 4 | 1 | 1 |
| Bug fixing (complex) | 2 | 1 | 3 | **5** | 2 | 3 | 1 |
| Bug fixing (simple) | 1 | 1 | 2 | 4 | **5** | 2 | 1 |
| Test writing | 1 | 1 | 2 | 3 | 4 | **5** | 1 |
| API design | 2 | 3 | 3 | **5** | 2 | 2 | 1 |
| Sprint planning | 4 | **5** | 4 | 1 | 1 | 2 | 2 |
| Task decomposition | **5** | 3 | 4 | 2 | 1 | 1 | 1 |
| Code review | 2 | 1 | **5** | 4 | 2 | 3 | 1 |
| Documentation | 2 | 4 | 2 | 3 | **5** | 3 | 4 |
| Release management | 1 | 1 | 2 | 1 | 1 | 3 | **5** |
| Quality assurance | 1 | 2 | 3 | 2 | 2 | **5** | 3 |
| Performance tuning | 2 | 1 | 2 | **5** | 1 | 3 | 1 |
| Scope estimation | 3 | **5** | 4 | 3 | 1 | 2 | 2 |
| Stakeholder comms | 3 | 4 | 3 | 1 | 1 | 2 | **5** |

---

## Matchmaking Algorithm

### Task Assignment Flow

```
1. Task arrives with metadata:
   - type (feature, bug, test, docs, infra, release)
   - complexity_score (1–12, from model-routing.md)
   - domain (backend, frontend, database, devops, design)
   - urgency (low, medium, high, critical)

2. Filter eligible agents:
   - Agent must be on a team that handles this task type
   - Agent must not be at capacity (max concurrent tasks)
   - Agent trust level must meet task sensitivity requirement

3. Score each eligible agent:
   competency  = specialization_matrix[agent][task_type]   (1–5)
   availability = 1.0 - (current_tasks / max_tasks)        (0–1)
   recency     = days_since_last_similar_task < 5 ? 1.2 : 1.0
   success     = task_success_rate[task_type]               (0–1)

   fit_score = (competency × 0.4) + (success × 0.3) + (availability × 0.2) + (recency × 0.1)

4. Assign to highest fit_score agent
   - Tie-break: prefer agent with lower current load
   - If no agent scores above 2.5: escalate to Sprint Lead for manual assignment

5. Override rules:
   - Alpha gets all architecture tasks regardless of score
   - QA Lead gets all quality gate decisions
   - Delivery gets all release tasks
   - Orchestrator gets all cross-team coordination
```

### Load Balancing

```
Max concurrent tasks per agent:
  Orchestrator:  3 (coordination tasks are lightweight)
  Planner:       2
  Sprint Lead:   3
  Alpha:         2 (complex tasks need focus)
  Beta:          3 (simpler tasks, higher throughput)
  QA Lead:       3
  Delivery:      2

When all eligible agents are at capacity:
  1. Queue task with priority ordering
  2. If urgent/critical: Sprint Lead may reassign lower-priority work
  3. If queue depth > 5: trigger dynamic scaling (see dynamic-scaling.md)
```
