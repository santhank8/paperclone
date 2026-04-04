# Ruling Template — Sprint Co Judge

Use this template for every dispute resolution. Fill in all fields, score the 4-Factor Matrix, and record the ruling. Post the completed ruling to the sprint channel and append a summary entry to [case-law.md](./case-law.md).

---

## Case Metadata

| Field | Value |
|---|---|
| **Case ID** | CASE-[NNN] |
| **Date** | [YYYY-MM-DD] |
| **Dispute Title** | [Short descriptive title] |
| **Parties** | [Agent A] vs [Agent B] |

---

## Background

[2-4 sentences describing the context. What phase is the sprint in? What triggered the disagreement? What is at stake if no ruling is made?]

---

## Arguments

### Party A — [Agent Name]

[Summarize their position in 2-3 sentences. Include any evidence or metrics they cited.]

### Party B — [Agent Name]

[Summarize their position in 2-3 sentences. Include any evidence or metrics they cited.]

---

## 4-Factor Score Matrix

Score each factor from 1 (low impact) to 5 (high impact) **from the perspective of Party A's proposed action**. Higher total favors Party A's position.

| Factor | Score (1-5) | Notes |
|---|---|---|
| **User Impact** | [score] | [How much does this affect the end user's experience?] |
| **Time Cost** | [score] | [Inverse: 5 = low time cost, 1 = very expensive in time] |
| **Quality Risk** | [score] | [Inverse: 5 = low risk to quality, 1 = high risk] |
| **Budget Impact** | [score] | [Inverse: 5 = within budget, 1 = significant overrun] |
| **Total** | [sum/20] | |

**Scoring guide**:
- Total ≥ 15: Strong case for BUILD
- Total 10–14: Judgment call — weigh precedent and sprint phase
- Total ≤ 9: Strong case for DEFER or KILL

---

## Ruling

**Decision**: [BUILD / DEFER / KILL]

**Rationale**:

[3-5 sentences explaining the decision. Reference the score matrix, any applicable precedent from case-law.md, and the current sprint phase/budget situation. Be specific about why this ruling serves the company's goals.]

---

## Precedent Established

> [1 sentence: the reusable principle this ruling creates for future disputes of this type.]

---

## Appeal Window

| Field | Value |
|---|---|
| **Appeal Deadline** | [Timestamp — 15 minutes from ruling, or end of current sprint phase, whichever comes first] |
| **Appeal Method** | Either party may submit a written counter-argument with new evidence not previously considered. |
| **Appeal Authority** | The Judge re-evaluates. If the Judge's second ruling is also contested, the Stakeholder makes the final call. |

---

## Enforcement

| Action | Responsible Agent | Deadline |
|---|---|---|
| [What must happen as a result of this ruling] | [Agent name] | [By when] |
| [Second action if needed] | [Agent name] | [By when] |

The **Enforcer** agent is responsible for verifying these actions are completed within the stated deadlines.
