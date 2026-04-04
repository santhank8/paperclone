# Sprint Co Voting Protocol

> Multi-agent voting and consensus mechanism.
> Effective: 2026-04-01 · Governed by: Constitution Article 4

---

## When Voting Is Used

Not every decision requires a vote. Sprint Co uses three decision mechanisms:

| Mechanism | When Used | Example |
|-----------|-----------|---------|
| **Unilateral** | Operational decisions within an agent's authority | Orchestrator assigns a task |
| **Judge Ruling** | Disputes, interpretation questions, precedent | Two agents disagree on scope |
| **Vote** | Cross-team decisions affecting multiple agents, process changes, trade-off decisions with no clear owner | Choosing between two architectures |

**General rule:** If the decision affects only one agent's domain, that agent decides. If it affects multiple agents and they agree, no vote is needed. If they disagree and the Orchestrator can't resolve it in 5 minutes, it goes to a vote or Judge ruling depending on the nature of the dispute.

---

## Voting Types

### Simple Majority (>50%)
Used for routine cross-team decisions where speed matters more than full consensus.

### Supermajority (≥2/3)
Used for decisions that change how the company operates or set precedent.

### Unanimous
Used only for the most consequential decisions that affect all agents.

---

## Who Votes on What

| Decision Type | Required Voters | Threshold | Tiebreaker |
|---------------|----------------|-----------|------------|
| Architecture choice | Sprint Lead, Engineer Alpha, Engineer Beta, QA Engineer | Simple Majority | Sprint Lead |
| Scope change (mid-sprint) | Product Planner, Stakeholder, Sprint Lead, Orchestrator | Supermajority | Judge |
| Process change proposal | All governance agents (Stakeholder, Critic, Judge, Enforcer, Historian) | Supermajority | Board |
| Tool/dependency adoption | Sprint Lead, Engineer Alpha, Engineer Beta, Delivery Engineer | Simple Majority | Sprint Lead |
| Quality gate waiver | QA Engineer, Critic, Orchestrator, Stakeholder | Unanimous | N/A (no waiver without unanimity) |
| Model selection override | Orchestrator, Treasurer, affected agent | Simple Majority | Orchestrator |
| Deployment strategy | Delivery Engineer, Sprint Lead, QA Engineer | Simple Majority | Delivery Engineer |
| Constitutional amendment | All 15 agents | Supermajority | Board ratification required regardless |
| Emergency scope cut | Orchestrator, Product Planner, Sprint Lead | Simple Majority | Orchestrator |

---

## Quorum Rules

A vote is only valid if quorum is met. Quorum varies by decision type:

| Decision Type | Minimum Voters Present |
|---------------|----------------------|
| Architecture / Technical | 3 of 4 required voters |
| Scope change | All 4 required voters |
| Process change | 4 of 5 governance agents |
| Quality gate waiver | All 4 required voters (unanimity implies full presence) |
| Constitutional amendment | 12 of 15 agents |
| Emergency decisions | 2 of 3 required voters |

If quorum is not met within 5 minutes, the Orchestrator may either extend the vote window by 5 minutes (once) or escalate to the Judge for a unilateral ruling.

---

## Abstention Rules

- Agents may abstain from a vote. Abstentions count toward quorum but not toward the threshold.
- An agent must state a reason for abstention (e.g., "insufficient context," "conflict of interest").
- If more than half of eligible voters abstain, the vote is invalid and escalates to the Judge.

---

## Conflict of Interest

An agent **must not** vote on decisions about their own work product:

- Engineers do not vote on whether their code passes QA
- QA Engineer does not vote on whether to waive a gate they manage
- The Critic does not vote on whether to accept their own review

The conflicted agent may present their case but must recuse from the actual vote. Failure to recuse is an Enforcer-reportable process violation.

---

## Vote Recording Format

Every vote is recorded using this template:

```markdown
## Vote Record

- **Vote ID:** VOTE-{SPRINT_ID}-{SEQ}
- **Date:** YYYY-MM-DD HH:MM UTC
- **Decision:** [Description of what is being decided]
- **Type:** Simple Majority | Supermajority | Unanimous
- **Eligible Voters:** [List]
- **Quorum Required:** N of M
- **Quorum Met:** Yes | No

### Votes Cast

| Agent | Vote | Reason (if No or Abstain) |
|-------|------|---------------------------|
| Agent Name | Yes / No / Abstain | [optional reason] |

### Result

- **Outcome:** Passed | Failed | Invalid (no quorum)
- **Tally:** X Yes, Y No, Z Abstain
- **Tiebreaker Used:** Yes (by [Agent]) | No
- **Effective Immediately:** Yes | No (pending [condition])
```

---

## Vote Override

The Board (human leadership) may override any vote outcome at any time. Overrides must include:

- The original vote record
- The Board's decision
- The rationale for the override

Overrides are recorded in the decision audit trail and do not set precedent unless the Board explicitly states otherwise. The Judge logs the override in the precedent registry with a note that it was Board-directed.

---

*Maintained by the Enforcer (process compliance) and the Judge (dispute resolution). Changes to this protocol follow the Constitutional amendment process (Article 6).*
