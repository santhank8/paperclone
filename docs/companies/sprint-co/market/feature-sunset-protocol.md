# Feature Sunset Protocol

> How Sprint Co deprecates and removes features responsibly.

**Owner:** Critic (proposes) + Stakeholder (user impact) + Treasurer (cost) + Judge (ruling)
**Updated:** As sunsets are proposed
**Status:** Active

---

## Sunset Triggers

A feature becomes a sunset candidate when any of these conditions are met:

| Trigger | Detection Method | Threshold |
|---------|-----------------|-----------|
| **Unused** | Analytics show zero or near-zero usage | < 5% of users for N consecutive sprints (N = 5) |
| **Maintenance cost exceeds value** | Treasurer's cost tracking | Maintenance hours > 2× the value delivered |
| **Replaced by better alternative** | Delivery ships a superior replacement | Replacement covers ≥ 90% of the original feature's use cases |
| **Security risk that can't be mitigated** | Critic or Scout identifies vulnerability | No fix feasible within 2 sprints |
| **Architectural drag** | Critic flags coupling or tech debt | Feature blocks ≥ 2 other improvements |

---

## Sunset Process

```
1. Critic proposes sunset
   └─ Documents: which feature, why, evidence
              │
              ▼
2. Stakeholder validates user impact
   └─ Runs persona evaluation: "Would any persona miss this?"
   └─ Checks feedback registry for related requests
   └─ Assesses: how many users are affected?
              │
              ▼
3. Treasurer calculates cost savings
   └─ Maintenance hours saved per sprint
   └─ Resources freed for other features
   └─ Cost of the removal work itself
              │
              ▼
4. Judge rules
   └─ Weighs evidence from all three inputs
   └─ Rules: APPROVE / DENY / DEFER (revisit in N sprints)
              │
              ▼
5. Board approves
   └─ Final sign-off on sunset timeline and communication plan
              │
              ▼
6. Delivery executes removal
   └─ Follows the sunset timeline:
      a. Announce deprecation (grace period begins)
      b. Add deprecation warnings to the feature
      c. Remove feature after grace period
      d. Verify no regressions
      e. Update docs, remove references
```

---

## Sunset Announcement Template

```markdown
## Deprecation Notice: [Feature Name]

**Effective date:** YYYY-MM-DD (Sprint S-NNN)
**Removal date:** YYYY-MM-DD (Sprint S-NNN)
**Grace period:** [N] sprints

### What's Being Removed
[Clear description of the feature being deprecated]

### Why
[Honest explanation — e.g., low usage, replaced by X, security concern]

### Impact
- **Who is affected:** [User types / personas]
- **What breaks:** [Specific workflows that will stop working]
- **What doesn't change:** [Related features that are NOT affected]

### Migration Path
[Step-by-step guide to move to the replacement, if one exists]

1. [Step 1]
2. [Step 2]
3. [Step 3]

If no replacement exists:
"We understand this removes functionality. [Explanation of why we believe this is the right trade-off.]"

### Timeline
| Date | Action |
|------|--------|
| YYYY-MM-DD | Deprecation announced |
| YYYY-MM-DD | Deprecation warnings added to feature |
| YYYY-MM-DD | Feature disabled by default (opt-in to keep using) |
| YYYY-MM-DD | Feature removed entirely |

### Questions or Concerns
[How to provide feedback — e.g., GitHub issue, Telegram]
```

---

## Grace Period Rules

| Feature Age | Usage Level | Grace Period |
|-------------|-------------|-------------|
| < 5 sprints | Any | 2 sprints |
| 5–20 sprints | Low (<10% users) | 3 sprints |
| 5–20 sprints | Moderate (10–40%) | 5 sprints |
| > 20 sprints | Any | 5 sprints minimum |
| Any | HIGH usage (>40%) | 10 sprints + Board escalation required |

### Grace Period Obligations
During the grace period, Sprint Co must:
- Display deprecation warnings when the feature is used
- Keep the feature fully functional (no degraded mode)
- Provide migration documentation
- Accept feedback that might reverse the decision

---

## Rollback Plan

If users provide compelling reasons to keep the feature during the grace period:

### Rollback Triggers
- 3+ users request the feature be kept within the grace period
- Stakeholder discovers an unmet need with no alternative
- The replacement feature underperforms expectations

### Rollback Process
1. Stakeholder escalates to Board with evidence
2. Judge reviews the new evidence
3. If rollback approved:
   - Cancel the sunset
   - Remove deprecation warnings
   - Announce reversal with explanation
   - Log the decision in the Sunset Registry
4. If rollback denied:
   - Document the reasoning
   - Proceed with original timeline
   - Offer to help affected users find workarounds

---

## Sunset Registry

| ID | Feature | Proposed By | Sprint Proposed | Reason | Grace Period | Status | Removal Sprint |
|----|---------|------------|-----------------|--------|-------------|--------|---------------|
| SUN-001 | Legacy CSV export | Critic | S-015 | Replaced by structured JSON export | 3 sprints | COMPLETE | S-018 |
| SUN-002 | v1 API endpoints | Critic | S-020 | v2 API fully covers all use cases | 5 sprints | IN GRACE PERIOD | S-025 (planned) |
| SUN-003 | Inline config format | Critic | S-022 | Security risk — allows code injection | 2 sprints | APPROVED | S-024 (planned) |

### Status Values
| Status | Meaning |
|--------|---------|
| `PROPOSED` | Critic has proposed sunset, under review |
| `APPROVED` | Judge has approved, grace period not yet started |
| `IN GRACE PERIOD` | Deprecation announced, grace period active |
| `COMPLETE` | Feature removed |
| `ROLLED BACK` | Sunset cancelled after new evidence |
| `DENIED` | Judge denied the sunset proposal |
