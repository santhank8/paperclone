# Evolving QA Rubric

> Adaptive evaluation criteria that grow with Sprint Co's delivery maturity.

**Rubric Version:** 1.0  
**Effective Date:** 2026-04-01  
**Owner:** QA Engineer + Critic  

---

## Base Rubric

Every deliverable is scored on four criteria, each rated 1–5.

| Criterion | 1 – Poor | 2 – Below Average | 3 – Acceptable | 4 – Good | 5 – Excellent |
|---|---|---|---|---|---|
| **Functionality** | Core features broken or missing | Major gaps; partial functionality | All stated requirements met | Exceeds requirements; edge cases handled | Bulletproof; graceful degradation everywhere |
| **UX** | Unusable; no coherent flow | Confusing navigation; inconsistent patterns | Functional and navigable; standard patterns | Polished interactions; clear feedback loops | Delightful; anticipates user needs; accessible |
| **Code Quality** | No structure; unreadable | Inconsistent style; no tests | Clean structure; basic test coverage | Well-architected; comprehensive tests; documented | Exemplary; easy to extend; full coverage + linting |
| **Product Depth** | Superficial implementation | Shallow; obvious shortcuts | Solid implementation of spec | Thoughtful extras; config-driven; extensible | Production-grade; monitoring, logging, resilience |

**Default Weights:** Functionality 30%, UX 25%, Code Quality 25%, Product Depth 20%.

**Composite Score** = Σ (criterion_score × weight)

**Pass threshold:** composite ≥ 3.0

---

## Weight Adjustments by Project Type

Weights shift based on what the sprint is building. PM declares project type at sprint start.

| Project Type | Functionality | UX | Code Quality | Product Depth | Rationale |
|---|---|---|---|---|---|
| **API / Backend** | 30% | 10% | 35% | 25% | No user-facing UI; code quality and reliability matter most |
| **Consumer App** | 25% | 35% | 20% | 20% | End-user experience is paramount |
| **Infrastructure / DevOps** | 35% | 5% | 30% | 30% | Must work correctly; depth = resilience |
| **Data Pipeline** | 35% | 10% | 25% | 30% | Correctness and robustness dominate |
| **Full-Stack Product** | 30% | 25% | 25% | 20% | Balanced (default weights) |

---

## Evolution Rules

### Recalibration Cadence

After every **10 sprints**, Critic and QA Engineer hold a rubric recalibration session.

### Recalibration Steps

1. **Collect Data** — Pull all QA eval scores and Critic grades from the last 10 sprints.
2. **Review False Positives** — Cases where QA scored ≥ 3.0 but the deliverable had issues post-deploy.
3. **Review False Negatives** — Cases where QA scored < 3.0 but the deliverable was actually fine.
4. **Adjust Weights** — If a criterion consistently under- or over-contributes, shift its weight by ±5%.
5. **Add/Remove Criteria** — Propose new criteria if recurring issues aren't captured (e.g., "Observability" or "Documentation Quality"). Remove criteria that never differentiate.
6. **Document Changes** — Record in Rubric Version History below.

### Constraints

- No single criterion may exceed 40% weight or fall below 5%.
- Total weights must sum to 100%.
- Changes require both Critic and QA agreement; disputes escalate to Judge.

---

## Rubric Version History

| Version | Date | Changes | Rationale | Approved By |
|---|---|---|---|---|
| 1.0 | 2026-04-01 | Initial rubric established | Baseline for Sprint Co operations | QA + Critic |
| | | | | |

---

## New Criteria Proposal Format

When proposing a new evaluation criterion:

```markdown
### Proposed Criterion: [Name]

**Proposer:** [Agent name]
**Date:** [YYYY-MM-DD]

**Definition:** What does this criterion measure?

**Scoring Scale:**
- 1: [description]
- 2: [description]
- 3: [description]
- 4: [description]
- 5: [description]

**Suggested Weight:** [X%] (state which existing criterion loses weight)

**Evidence:** Why is this needed? Cite specific sprint outcomes or recurring issues.

**Impact:** How would past sprints have scored differently with this criterion?
```

### Approval Process

1. Proposer submits during recalibration session.
2. QA and Critic discuss; if both agree, criterion is added next sprint.
3. If disagreement, Judge mediates.
4. Trial period: new criterion runs in "shadow mode" for 3 sprints (scored but not counted toward composite) before becoming official.
