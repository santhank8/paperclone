# Sprint Co Board Minutes Template

> Standard template for recording governance meeting outcomes.
> Effective: 2026-04-01 · Governed by: Constitution Articles 7, 8, 9

---

## Usage

Board Minutes are generated after any governance meeting — whether a scheduled review, an emergency Board session, or a major multi-agent decision point. The Historian is responsible for producing the minutes. The Enforcer validates completeness.

---

## Template

```markdown
# Board Minutes

- **Meeting ID:** BOARD-{YYYY}-{MM}-{DD}-{SEQ}
- **Date:** YYYY-MM-DD HH:MM–HH:MM UTC
- **Type:** Scheduled Review | Emergency Session | Sprint Retrospective | Amendment Review
- **Called By:** [Agent or Board member who called the meeting]

## Attendees

| Agent | Role | Present | Notes |
|-------|------|---------|-------|
| Sprint Orchestrator | Executive | Yes/No | |
| Product Planner | Product | Yes/No | |
| Sprint Lead | Engineering | Yes/No | |
| Engineer Alpha | Engineering | Yes/No | |
| Engineer Beta | Engineering | Yes/No | |
| QA Engineer | QA & Delivery | Yes/No | |
| Delivery Engineer | QA & Delivery | Yes/No | |
| Stakeholder | Governance | Yes/No | |
| Critic | Governance | Yes/No | |
| Judge | Governance | Yes/No | |
| Enforcer | Governance | Yes/No | |
| Historian | Governance | Yes/No | |
| Treasurer | Governance | Yes/No | |
| Scout | Ecosystem | Yes/No | |
| Diplomat | Ecosystem | Yes/No | |
| Board (Human) | Leadership | Yes/No | |

**Quorum:** Met / Not Met (X of Y required attendees present)

## Agenda

1. [Agenda item 1]
2. [Agenda item 2]
3. [Agenda item 3]
4. Open items / Any Other Business

## Decisions Made

| # | Agenda Item | Decision | Vote Count | Dissents | Decision Record |
|---|-------------|----------|------------|----------|-----------------|
| 1 | [item] | [what was decided] | X Yes / Y No / Z Abstain | [agent names or "None"] | DEC-{ID} |
| 2 | [item] | [what was decided] | X Yes / Y No / Z Abstain | [agent names or "None"] | DEC-{ID} |

## Dissents Raised

| Dissent ID | Filing Agent | Subject | Resolution | Status |
|------------|-------------|---------|------------|--------|
| DISSENT-{ID} | [agent] | [brief] | [outcome] | Resolved / Pending / Escalated |

## Key Discussion Points

### [Agenda Item 1 Title]

**Presenter:** [Agent name]
**Summary:** [2-3 sentence summary of the discussion]
**Outcome:** [Decision, deferral, or action item]

### [Agenda Item 2 Title]

**Presenter:** [Agent name]
**Summary:** [2-3 sentence summary of the discussion]
**Outcome:** [Decision, deferral, or action item]

## Action Items

| # | Action | Owner | Due By | Status |
|---|--------|-------|--------|--------|
| 1 | [action description] | [agent name] | [date/sprint] | Open |
| 2 | [action description] | [agent name] | [date/sprint] | Open |

## Precedent Updates

| Precedent ID | Summary | Set By | Replaces |
|-------------|---------|--------|----------|
| PREC-{ID} | [one-line summary] | Judge | [prior precedent ID or "New"] |

## Metrics Snapshot (if Sprint Retrospective)

| Metric | This Sprint | Trend |
|--------|------------|-------|
| Delivery success | Yes/Partial/No | — |
| QA pass rate | X% | ↑/↓/→ |
| Budget utilization | X% of allocation | ↑/↓/→ |
| Escalations | N | ↑/↓/→ |
| Dissents filed | N | ↑/↓/→ |
| Time to delivery | HH:MM | ↑/↓/→ |

## Next Meeting Trigger

- [ ] Scheduled: [date] (for periodic reviews)
- [ ] Sprint completion (for retrospectives)
- [ ] Emergency: triggered by [condition]
- [ ] Amendment review: triggered by [proposal ID]

---

**Minutes prepared by:** Historian
**Minutes reviewed by:** Enforcer
**Minutes approved by:** [Board / Orchestrator]
**Filed:** YYYY-MM-DD
```

---

## Filing Instructions

1. The **Historian** drafts the minutes during or immediately after the meeting
2. The **Enforcer** reviews for completeness (all decisions recorded, all action items assigned)
3. Minutes are filed in the sprint's governance record
4. All referenced Decision Records and Dissent Records must be linked
5. Minutes become part of the permanent audit trail (Constitution Article 10.3)

---

*Maintained by the Historian (authoring) and the Enforcer (validation). Board Minutes are protected records under the Decision Audit Trail retention policy.*
