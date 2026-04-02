# A/B Testing Protocol

> How Stakeholder proposes and Sprint Co runs controlled experiments.

**Owner:** Stakeholder (proposes) + Sprint Lead (feasibility) + Treasurer (cost)
**Updated:** As experiments are proposed
**Status:** Active

---

## When to A/B Test

Not every decision needs an experiment. A/B testing is appropriate when:

| Trigger | Example |
|---------|---------|
| **Significant UI decisions** | New dashboard layout vs. current layout |
| **New interaction patterns** | Wizard-based onboarding vs. single-page setup |
| **Alternative architectures** | REST endpoint vs. WebSocket for real-time updates |
| **Conflicting persona feedback** | Maria wants simplicity, James wants configurability — which default? |
| **High-effort features with uncertain value** | Before investing 8+ hours, validate the approach |

### When NOT to A/B Test
- Bug fixes (just fix it)
- Security patches (just ship it)
- Features with clear user demand and low risk
- Changes mandated by compliance or spec

---

## Experiment Proposal Template

```markdown
## Experiment: [EXP-NNN] [Short Name]

**Proposed by:** Stakeholder
**Date:** YYYY-MM-DD
**Sprint:** S-NNN

### Hypothesis
If we [change], then [metric] will [improve/decrease] by [expected amount]
because [reasoning].

### Variants

**Control (A):** [Description of current behavior]

**Treatment (B):** [Description of proposed change]

### Measurement
- **Primary metric:** [What we're measuring — e.g., task completion time]
- **Secondary metrics:** [Supporting signals — e.g., error rate, user satisfaction]
- **Sample size:** [Number of interactions or users needed]
- **Duration:** [How many sprints to run the experiment]

### Expected Lift
[What improvement we expect in the primary metric]

### Cost to Run
- **Implementation effort:** [T-shirt size for building variant B]
- **Maintenance overhead:** [Cost of running both variants simultaneously]
- **Opportunity cost:** [What we can't build while running this experiment]

### Risk Assessment
- **What if Treatment wins?** [Ship Treatment, remove Control]
- **What if Control wins?** [Remove Treatment code, document learnings]
- **What if inconclusive?** [Extend duration / increase sample / abandon]
```

---

## Experiment Approval Flow

```
Stakeholder proposes experiment
        │
        ▼
Treasurer reviews cost
  • Implementation effort within budget?
  • Maintenance overhead acceptable?
  • Opportunity cost justified?
        │
        ▼ (approved / rejected with reason)
Sprint Lead reviews feasibility
  • Can we build both variants cleanly?
  • Can we measure the metrics?
  • Can we run it within the proposed duration?
        │
        ▼ (approved / rejected with reason)
Board approves
  • Does this experiment align with sprint goals?
  • Is the risk/reward ratio acceptable?
        │
        ▼ (approved → execute / rejected → archive)
```

### Approval Criteria
- Total experiment cost must not exceed 25% of the sprint budget
- No more than 2 experiments may run concurrently
- Experiments affecting core stability require unanimous Board approval

---

## Results Template

```markdown
## Results: [EXP-NNN] [Short Name]

**Run period:** Sprint S-NNN to S-NNN
**Status:** Complete

### Variant A (Control) Metrics
- Primary metric: [value]
- Secondary metric 1: [value]
- Secondary metric 2: [value]

### Variant B (Treatment) Metrics
- Primary metric: [value]
- Secondary metric 1: [value]
- Secondary metric 2: [value]

### Analysis
- **Winner:** [Variant A / Variant B / Inconclusive]
- **Confidence level:** [HIGH / MEDIUM / LOW]
- **Lift observed:** [+X% / -X% / no significant difference]

### Recommendation
[Ship Treatment / Keep Control / Extend experiment / Redesign and retest]

### Learnings
[What did we learn that applies beyond this experiment?]
```

---

## Experiment Registry

| ID | Name | Proposed | Status | Winner | Learnings |
|----|------|----------|--------|--------|-----------|
| EXP-001 | Wizard vs Single-Page Onboarding | S-008 | Complete | Treatment (Wizard) | Users complete setup 40% faster with guided flow |
| EXP-002 | REST vs WebSocket for Live Updates | S-012 | Running | — | — |
| EXP-003 | Dark Mode Default | S-015 | Proposed | — | — |

### Status Values
- **Proposed** — Awaiting approval
- **Approved** — Approved, awaiting implementation
- **Running** — Both variants live, collecting data
- **Complete** — Results analyzed, decision made
- **Abandoned** — Cancelled before completion (document why)
