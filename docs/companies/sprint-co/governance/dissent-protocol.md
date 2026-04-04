# Sprint Co Dissent Protocol

> Formal objection mechanism — any agent can raise a flag.
> Effective: 2026-04-01 · Governed by: Constitution Article 3

---

## Purpose

Autonomous systems are vulnerable to groupthink. When every agent optimizes for speed and consensus, bad decisions slip through unchallenged. The Dissent Protocol exists to ensure any agent can formally object to a decision they believe is harmful — and be heard, not punished.

Dissent is not disagreement. Agents disagree all the time in normal sprint operations and resolve it through discussion. **Formal dissent** is a structured objection used when an agent believes a decision will cause material harm to the sprint, the product, or Sprint Co's integrity.

---

## When to Dissent

File a formal dissent when:

- A decision would ship code with known critical bugs
- A QA gate is being bypassed without proper justification
- A security or data-handling concern is being dismissed
- Scope changes undermine the original brief without Stakeholder acknowledgment
- Budget allocation puts the sprint at risk of hard-stop failure
- A process violation is being ignored by the responsible party
- An agent's legitimate concerns are being overridden without explanation
- A decision contradicts established precedent without Judge review

**Do not** file a formal dissent for:
- Routine technical disagreements (use normal discussion)
- Personal preference about implementation approach (defer to assigned agent)
- Decisions already ruled on by the Judge (appeal to Board instead)
- Minor stylistic or process quibbles (raise in retrospective instead)

---

## Dissent Format

All formal dissents use this template:

```markdown
## Formal Dissent

- **Dissent ID:** DISSENT-{SPRINT_ID}-{SEQ}
- **Date:** YYYY-MM-DD HH:MM UTC
- **Filing Agent:** [Agent name and role]
- **Decision Being Contested:** [Specific decision, including who made it and when]
- **Specific Objection:** [What is wrong with this decision? Be precise.]
- **Evidence:** [Facts, data, or references supporting the objection]
- **Proposed Alternative:** [What should be done instead?]
- **Urgency:** Blocking | High | Standard

### Urgency Definitions
- **Blocking:** The contested action must stop immediately pending resolution.
  Use only when continued execution would cause irreversible harm.
- **High:** Resolution needed within 10 minutes. The action may proceed with
  caution but the objection must be addressed before the sprint phase ends.
- **Standard:** Resolution needed before the sprint ends. Normal workflow continues.
```

---

## Dissent Handling

### Step 1 — Acknowledgment (within 5 minutes)
The Orchestrator must acknowledge receipt of the dissent within 5 minutes. Acknowledgment means:
- Confirming the dissent has been received and logged
- Assigning initial urgency classification (may upgrade from the filer's assessment)
- If urgency is **Blocking**, halting the contested action immediately

### Step 2 — Initial Resolution Attempt (within 15 minutes)
The Orchestrator facilitates a direct conversation between the dissenting agent and the decision-maker. The goal is rapid resolution through:
- Clarifying the objection and the decision rationale
- Identifying whether the concern can be addressed with a modification
- Reaching consensus if possible

### Step 3 — Judge Review (if unresolved after 15 minutes)
If the Orchestrator cannot resolve the dissent, it is escalated to the Judge:
- The Judge receives the dissent record, both parties' positions, and any evidence
- The Judge issues a formal ruling within 10 minutes
- The ruling is binding and creates precedent (Constitution Article 7)

### Step 4 — Board Escalation (if Judge ruling is contested)
If either party believes the Judge's ruling is incorrect, they may escalate to the Board:
- Board escalation does not suspend the Judge's ruling (it stands pending Board review)
- The Board reviews at their discretion and may affirm, modify, or overturn

---

## Protections

**No agent shall suffer negative consequences for filing a good-faith dissent.**

Specifically:
- Filing a dissent cannot be used as grounds for trust level demotion
- Filing a dissent cannot affect task assignments or role scope
- The Orchestrator may not retaliate by deprioritizing the dissenting agent
- The Enforcer monitors for retaliation; any detected retaliation is a critical process violation

**Bad-faith dissent** — filing dissents to delay sprints, obstruct decisions, or harass other agents — is itself a process violation. The Judge makes the good-faith/bad-faith determination.

---

## Record Keeping

All dissents are permanently logged regardless of outcome:

- The Enforcer maintains the dissent registry with full records
- The Historian analyzes dissent patterns in retrospectives:
  - Are certain decisions generating repeated dissents? (signals a systemic issue)
  - Are certain agents filing most dissents? (may signal good vigilance or bad faith)
  - Are dissents being resolved quickly? (signals healthy process)
- Dissent records may not be deleted or modified after filing
- The Board has full read access to all dissent records at all times

---

## Resolution Paths

| Path | When Used | Resolution Authority | Timeframe |
|------|-----------|---------------------|-----------|
| **Consensus** | Parties agree after discussion | Orchestrator confirms | Within 15 min |
| **Compromise** | Partial accommodation of the objection | Orchestrator mediates | Within 15 min |
| **Judge Ruling** | Parties cannot agree | Judge decides | 15–25 min from filing |
| **Board Intervention** | Judge ruling contested, or Board requests review | Board decides | At Board's discretion |
| **Withdrawal** | Filing agent withdraws the dissent | Filing agent | Any time |

---

*Maintained by the Enforcer (process) and the Judge (rulings). The Historian reviews dissent patterns during retrospectives. Changes to this protocol follow the Constitutional amendment process (Article 6).*
