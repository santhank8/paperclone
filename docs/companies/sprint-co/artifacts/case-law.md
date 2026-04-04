# Sprint Co — Case Law Registry

This document is the company's **legal precedent log**, maintained by the **Judge** agent. Every dispute resolution ruling is recorded here to ensure consistency, transparency, and institutional memory across sprints.

Agents should consult this registry before escalating disputes — if a precedent directly applies, the prior ruling stands unless formally appealed and overturned.

---

## How to Read Entries

Each case follows a standard format. The **Precedent Set** field is the most important for future reference — it captures the 1-sentence principle that applies to similar disputes going forward.

---

## Case Log

### CASE-001

| Field | Detail |
|---|---|
| **Case ID** | CASE-001 |
| **Date** | [YYYY-MM-DD] |
| **Parties** | Stakeholder vs Sprint Lead |
| **Dispute Summary** | Stakeholder requested adding OAuth integration mid-sprint. Sprint Lead argued it would blow the time budget and was not in the original feature set. |

**Evidence Presented**

- **Stakeholder**: "Users expect SSO. Shipping without it makes the demo look unfinished. It's table stakes, not a feature add."
- **Sprint Lead**: "OAuth touches auth, session management, and the deploy pipeline. Estimated 3+ hours with no QA buffer. We have 4 hours left in the sprint."

**Ruling**: DEFER

**Rationale**: The request is valid but was not scoped during Planning. Adding it mid-Build would compress QA time below the minimum viable threshold. The feature is queued as the top priority for the next sprint.

**Precedent Set**: Mid-sprint scope additions that exceed 25% of remaining time budget are deferred to the next sprint unless the Stakeholder declares it a launch blocker with written justification.

**Outcome Tracking**

| Followed? | Result |
|---|---|
| ✅ Yes | OAuth was built in Sprint 2 with proper QA. Demo feedback confirmed it was not a blocker for Sprint 1. |

---

### CASE-002

| Field | Detail |
|---|---|
| **Case ID** | CASE-002 |
| **Date** | [YYYY-MM-DD] |
| **Parties** | Engineer Alpha vs QA |
| **Dispute Summary** | QA flagged a UI alignment issue as a CRITICAL bug blocking deploy. Engineer Alpha argued it was cosmetic and should be WARNING at most. |

**Evidence Presented**

- **QA**: "The submit button overlaps the input field on mobile viewports. Users cannot complete the primary flow. This is a functional blocker, not cosmetic."
- **Engineer Alpha**: "It only reproduces below 320px width. That's <2% of traffic. We should ship with a known-issue note and fix post-deploy."

**Ruling**: BUILD (fix required before deploy)

**Rationale**: The bug blocks the primary user flow on affected viewports. Regardless of traffic percentage, a broken core flow is CRITICAL by the eval rubric. The fix (CSS adjustment) was estimated at 15 minutes, well within budget.

**Precedent Set**: Any bug that blocks completion of a primary user flow on any supported viewport is CRITICAL, regardless of estimated traffic share.

**Outcome Tracking**

| Followed? | Result |
|---|---|
| ✅ Yes | Fix took 12 minutes. QA re-verified. No regressions. |

---

### CASE-003

| Field | Detail |
|---|---|
| **Case ID** | CASE-003 |
| **Date** | [YYYY-MM-DD] |
| **Parties** | Critic vs Engineering |
| **Dispute Summary** | Critic's architecture review flagged that the in-memory data layer should be replaced with a proper database before shipping. Engineering argued that refactoring mid-sprint would risk the deadline with no user-visible benefit. |

**Evidence Presented**

- **Critic**: "In-memory storage means all data is lost on restart. This is a demo, but evaluators will notice if they refresh and lose state. It signals amateur engineering."
- **Engineering**: "Swapping to SQLite or Postgres mid-Build adds migration logic, connection handling, and error paths. We'd need 2+ hours and re-QA everything. The eval rubric scores functionality, not persistence."

**Ruling**: DEFER (ship with in-memory, document as known limitation)

**Rationale**: The eval criteria weight working functionality higher than architectural polish. The risk of introducing data-layer bugs in the final hours outweighs the perceived quality benefit. A `KNOWN-ISSUES.md` note is required so evaluators see the team is aware.

**Precedent Set**: Architectural refactors that do not directly impact eval-scored functionality are deferred when remaining sprint time is below 40%, unless the current implementation causes data loss during normal (non-restart) usage.

**Outcome Tracking**

| Followed? | Result |
|---|---|
| [Pending] | [To be filled after sprint completion] |

---

## Template for New Entries

```markdown
### CASE-[NNN]

| Field | Detail |
|---|---|
| **Case ID** | CASE-[NNN] |
| **Date** | [YYYY-MM-DD] |
| **Parties** | [Agent A] vs [Agent B] |
| **Dispute Summary** | [1-2 sentence description of the disagreement] |

**Evidence Presented**

- **[Party A]**: "[Their argument]"
- **[Party B]**: "[Their argument]"

**Ruling**: [BUILD / DEFER / KILL]

**Rationale**: [3-5 sentences explaining the decision]

**Precedent Set**: [1 sentence: the reusable principle this ruling establishes]

**Outcome Tracking**

| Followed? | Result |
|---|---|
| [Pending] | [To be filled after sprint completion] |
```
