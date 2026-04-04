# Sprint Co Decision Audit Trail

> Every significant decision gets recorded — for accountability and learning.
> Effective: 2026-04-01 · Governed by: Constitution Articles 8, 9, 10

---

## Purpose

Sprint Co makes hundreds of decisions per sprint. Most are routine. Some are consequential. The Decision Audit Trail ensures that every significant decision is recorded with enough context to:

1. **Hold agents accountable** for their choices
2. **Enable learning** by comparing expected vs actual outcomes
3. **Build institutional memory** so the company doesn't repeat mistakes
4. **Provide transparency** so the Board can review how decisions were made
5. **Support dispute resolution** when decisions are later contested

---

## Decision Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Strategic** | Decisions about what to build and why | Scope selection, feature prioritization, brief interpretation |
| **Tactical** | Decisions about how to execute within the sprint | Task breakdown, agent assignment, phase timing |
| **Technical** | Decisions about architecture, tools, and implementation | Framework choice, API design, dependency selection |
| **Financial** | Decisions about budget, model selection, and cost trade-offs | Model upgrades, budget reallocation, cost-saving measures |
| **Process** | Decisions about how the company operates | Gate waivers, escalation outcomes, process changes |

---

## What Gets Recorded

Not every micro-decision needs a record. Record a decision when any of the following are true:

- It affects more than one agent
- It changes the sprint plan or scope
- It involves a trade-off (quality vs speed, cost vs capability)
- It overrides a previous decision or precedent
- It is the result of a vote, Judge ruling, or escalation
- It involves budget allocation above 10% of sprint budget
- It bypasses or waives a standard process
- Any party to the decision requests it be recorded

---

## Decision Record Template

```markdown
## Decision Record

- **Decision ID:** DEC-{SPRINT_ID}-{SEQ}
- **Date:** YYYY-MM-DD HH:MM UTC
- **Decision-Maker:** [Agent name and role, or "Vote" or "Judge Ruling"]
- **Category:** Strategic | Tactical | Technical | Financial | Process
- **Context:** [What situation prompted this decision? 2-3 sentences max.]

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A: [description] | [pros] | [cons] |
| B: [description] | [pros] | [cons] |

### Decision Made

[What was decided, stated clearly in one sentence.]

### Rationale

[Why this option was chosen over others. Reference precedent if applicable.]

### Stakeholders Affected

[Which agents/teams are impacted by this decision?]

### Expected Outcome

[What should happen as a result of this decision?]

---

### Post-Decision (filled by Historian)

- **Actual Outcome:** [What actually happened?]
- **Outcome Assessment:** As Expected | Better | Worse | Mixed
- **Lessons:** [What did we learn from this decision?]
- **Follow-up Actions:** [Any process changes or precedent updates needed?]
```

---

## Access Rules

| Role | Read Access | Write Access |
|------|-----------|-------------|
| Board (human) | All records | Can annotate any record |
| Orchestrator | All records | Can create records for unilateral decisions |
| Judge | All records | Creates records for rulings; updates precedent references |
| Enforcer | All records | Creates records for process decisions; flags incomplete records |
| Historian | All records | Fills post-decision sections; creates retrospective summaries |
| All other agents | Records in their category/team | Can create records for decisions they make |

**No agent may delete or modify the core fields of a decision record after it is filed.** Only the post-decision section (filled by the Historian) may be added after the initial record.

---

## Retention Policy

| Record Type | Retention Period | Archive Action |
|-------------|-----------------|---------------|
| Strategic decisions | Permanent | Never deleted |
| Process decisions (votes, rulings) | Permanent | Never deleted |
| Tactical decisions | 90 days active, then archived | Moved to archive, searchable |
| Technical decisions | 90 days active, then archived | Moved to archive, searchable |
| Financial decisions | Permanent | Never deleted (audit requirement) |
| Dissent-related decisions | Permanent | Never deleted |

**Archive** means the record is moved out of the active decision log but remains fully searchable and readable. The Historian is responsible for archival.

---

## Integration Points

- **Voting Protocol:** Every vote produces a decision record automatically
- **Dissent Protocol:** Every resolved dissent produces a decision record
- **Escalation Matrix:** Every escalation resolution produces a decision record
- **Judge Rulings:** Every ruling produces a decision record with precedent tags
- **Retrospectives:** The Historian reviews all sprint decision records during retro

---

*Maintained by the Enforcer (completeness and compliance) and the Historian (post-decision analysis and archival). The audit trail is protected under Constitution Article 10.3 — it may not be tampered with, deleted, or selectively edited.*
