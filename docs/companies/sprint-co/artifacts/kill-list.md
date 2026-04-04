<!-- TEMPLATE: Critic Feature Kill List
     Agent: Critic (governance)
     When: Updated each sprint during the critique phase; reviewed by PM before next sprint planning
     Fill in all [bracketed] placeholders with actual content.
     Delete this comment block when producing a real kill list. -->

# Feature Kill List

## Meta

| Field               | Value                                |
|---------------------|--------------------------------------|
| **Date**            | [YYYY-MM-DD]                         |
| **Author**          | Critic Agent                         |
| **Current Sprint**  | [sprint-NNN]                         |
| **Last Updated**    | [YYYY-MM-DD]                         |
| **Status**          | [ACTIVE — reviewed each sprint]      |

---

## Purpose

This document tracks features that should be considered for removal, features that are on a watchlist, and features that have already been killed. The goal is to keep the product lean and intentional. Adding features is easy; removing them is hard. This list makes removal a deliberate, tracked process.

**Kill criteria** — a feature should be proposed for kill if any of the following are true:

- No user engagement or evidence of demand after 2+ sprints
- Adds maintenance burden disproportionate to its value
- Conflicts with product direction or creates confusion
- Was built as an experiment and the experiment concluded
- Duplicates functionality available elsewhere in the product

---

## Features Proposed for Deprecation

Features the Critic recommends removing. Each requires PM acknowledgment before action.

| # | Feature                | Sprint Introduced | Reason for Kill                                   | User Impact                        | Effort Saved                     | PM Decision         |
|---|------------------------|-------------------|---------------------------------------------------|------------------------------------|----------------------------------|---------------------|
| 1 | [Feature name]         | [sprint-NNN]      | [Why it should be removed — be specific]          | [Who is affected and how severely] | [Dev time / maintenance freed]   | [PENDING / APPROVED / REJECTED] |
| 2 | [Feature name]         | [sprint-NNN]      | [Reason]                                          | [Impact]                           | [Effort saved]                   | [PENDING / APPROVED / REJECTED] |
| 3 | [Feature name]         | [sprint-NNN]      | [Reason]                                          | [Impact]                           | [Effort saved]                   | [PENDING / APPROVED / REJECTED] |

<!-- Add rows as needed. Remove rows once a feature is killed (move to Previously Killed) or the proposal is rejected (note in Appendix). -->

If no features are proposed this sprint, write: "No features proposed for deprecation this sprint."

---

## Features Under Watch

Not recommending removal yet, but these features are concerning. If the concern is not addressed within the stated timeframe, they will be proposed for kill.

| # | Feature                | Sprint Introduced | Concern                                           | Watch Since     | Escalation Deadline | Resolution Path                |
|---|------------------------|-------------------|---------------------------------------------------|-----------------|---------------------|--------------------------------|
| 1 | [Feature name]         | [sprint-NNN]      | [What's worrying — e.g., "No usage data, unclear value prop"] | [sprint-NNN]    | [sprint-NNN+2]      | [What would save it — e.g., "Show user engagement metrics"] |
| 2 | [Feature name]         | [sprint-NNN]      | [Concern]                                         | [sprint-NNN]    | [sprint-NNN+2]      | [Resolution path]              |
| 3 | [Feature name]         | [sprint-NNN]      | [Concern]                                         | [sprint-NNN]    | [sprint-NNN+2]      | [Resolution path]              |

<!-- Add rows as needed. Promote to "Proposed for Deprecation" if the escalation deadline passes without resolution. -->

If no features are under watch, write: "No features currently under watch."

---

## Previously Killed Features

Tracking past kill decisions for accountability and reference. This section is append-only.

| # | Feature                | Sprint Introduced | Sprint Killed | Reason                                            | Outcome                            |
|---|------------------------|-------------------|---------------|---------------------------------------------------|------------------------------------|
| 1 | [Feature name]         | [sprint-NNN]      | [sprint-NNN]  | [Why it was removed]                              | [What happened after — e.g., "No user complaints; saved 2hrs/sprint maintenance"] |
| 2 | [Feature name]         | [sprint-NNN]      | [sprint-NNN]  | [Reason]                                          | [Outcome]                          |

<!-- Add rows as features are killed. Never remove rows from this section. -->

If no features have been killed yet, write: "No features have been killed yet. This table will populate as the product matures."

---

## Kill Process

For reference, the standard process for killing a feature:

1. **Critic proposes** — Feature added to "Proposed for Deprecation" with rationale
2. **PM reviews** — PM accepts, rejects, or defers the proposal
3. **If accepted** — Feature is scheduled for removal in the next sprint
4. **Removal sprint** — Engineer agent removes the feature; Critic verifies removal
5. **Post-kill** — Feature moved to "Previously Killed" with outcome tracked

---

## Appendix

- **Related critique:** [link or path to the sprint-critique.md that prompted this update]
- **Rejected proposals:** [Note any proposals that were rejected this sprint and why, for the record]
- **Notes:** [Additional context or reasoning.]
