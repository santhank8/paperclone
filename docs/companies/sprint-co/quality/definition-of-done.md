# Definition of Done

> The evolving contract that defines when work is truly complete.

**Version:** 1.0  
**Effective Date:** 2026-04-01  
**Owner:** Enforcer (enforcement), Judge (approval)  

---

## Current Definition of Done

### Feature-Level DoD

A feature is done when **all** of the following are true:

- [ ] **Code complete** — All acceptance criteria implemented; no TODOs or placeholder code.
- [ ] **Tests pass** — Unit tests, integration tests, and any E2E tests pass in CI.
- [ ] **QA eval ≥ 3.0** — QA Engineer composite score meets the pass threshold.
- [ ] **Self-eval submitted** — Implementing agent has submitted a self-evaluation.
- [ ] **No CRITICAL bugs** — Zero open bugs classified as CRITICAL severity.
- [ ] **Security check clean** — No CRITICAL security findings from the security audit.
- [ ] **Deployed to production** — Feature is live and verified in production environment.
- [ ] **Activity logged** — All mutations logged in Paperclip activity log.

### Sprint-Level DoD

A sprint is done when **all** of the following are true:

- [ ] **All V1 features shipped** — Every feature committed to the sprint is deployed.
- [ ] **Compliance report clean** — Enforcer compliance report shows no unresolved violations.
- [ ] **Sprint report generated** — Historian has produced the sprint narrative report.
- [ ] **Critic review complete** — Critic has graded the sprint.
- [ ] **Paperclip issues updated** — All associated Paperclip issues moved to final status.
- [ ] **No CRITICAL bugs in production** — Zero known CRITICAL bugs in the live system.
- [ ] **Performance budgets met** — No blocked metrics per the performance budget.

---

## Evolution Process

The Definition of Done is a living document. It evolves based on what Sprint Co learns.

### Step 1 — Historian Proposes Changes

After each retrospective, the Historian reviews patterns:

- Recurring bugs that slip through → add a DoD item to catch them.
- DoD items that are always trivially met → consider removing (reduce checklist fatigue).
- New quality dimensions emerging → propose new items.

Historian writes a **DoD Change Proposal**:

```markdown
### DoD Change Proposal

**Date:** YYYY-MM-DD
**Proposer:** Historian
**Type:** ADD / REMOVE / MODIFY

**Current Item (if modifying/removing):**
> [exact current text]

**Proposed Change:**
> [new text or "REMOVE"]

**Evidence:** [Which retrospective patterns or sprint outcomes justify this?]

**Impact:** [How would this have changed the last 3 sprints?]
```

### Step 2 — Enforcer Validates

Enforcer reviews the proposal for:

- **Enforceability** — Can this be objectively verified?
- **Proportionality** — Does the benefit justify the overhead?
- **Consistency** — Does it align with existing quality standards?

Enforcer either approves, requests modification, or rejects with rationale.

### Step 3 — Judge Approves

Final approval from Judge. Judge considers:

- Impact on sprint velocity.
- Whether it sets appropriate quality bar for the company's maturity level.
- Alignment with company goals.

---

## DoD Version History

| Version | Date | Change | Type | Rationale | Proposed By | Approved By |
|---|---|---|---|---|---|---|
| 1.0 | 2026-04-01 | Initial DoD established | CREATE | Baseline for Sprint Co | — | Judge |
| | | | | | | |

---

## DoD Compliance Tracking

Track DoD adherence over sprints to identify systemic gaps.

### Feature-Level Compliance

| Sprint | Features | All Items Met | Partial | Failed | Compliance Rate |
|---|---|---|---|---|---|
| S-01 | | | | | |
| S-02 | | | | | |
| S-03 | | | | | |

### Most Commonly Missed Items

| DoD Item | Times Missed (last 10 sprints) | Trend |
|---|---|---|
| | | |

**Review cadence:** Every 5 sprints, Enforcer reviews compliance data and flags items that are missed > 30% of the time for process improvement.

### Compliance Actions

- **Item missed once:** Note in sprint report.
- **Item missed 3+ sprints in a row:** Enforcer initiates root cause analysis.
- **Item never passes:** Historian proposes the item be modified or removed (it may be unrealistic or poorly defined).
