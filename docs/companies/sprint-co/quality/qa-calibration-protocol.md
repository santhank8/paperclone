# QA Calibration Protocol

> Keeping Critic and QA Engineer aligned on what "quality" means.

**Cadence:** Every 5th sprint  
**Participants:** QA Engineer, Critic  
**Escalation:** Judge  

---

## Purpose

The QA Engineer and Critic both evaluate sprint output, but from different angles:

- **QA Engineer** scores deliverables against the rubric (quantitative, structured).
- **Critic** grades the overall sprint (qualitative, holistic).

Over time these perspectives can drift. QA might pass work that Critic considers mediocre, or Critic might harshly grade work that meets all functional requirements. Calibration sessions realign their standards.

---

## Calibration Process

### Step 1 — QA Presents Eval Scores

QA Engineer compiles evaluation scores from the last 5 sprints:

| Sprint | Feature | Functionality | UX | Code Quality | Product Depth | Composite | Pass/Fail |
|---|---|---|---|---|---|---|---|
| S-01 | Auth API | 4 | 3 | 4 | 3 | 3.55 | PASS |
| ... | ... | ... | ... | ... | ... | ... | ... |

Key observations: trends, outliers, areas of consistent weakness.

### Step 2 — Critic Presents Grades

Critic compiles sprint-level grades from the same period:

| Sprint | Grade | Key Strengths | Key Weaknesses | Recommendation |
|---|---|---|---|---|
| S-01 | B+ | Solid auth; clean code | UX rough on error states | Ship with notes |
| ... | ... | ... | ... | ... |

Key observations: recurring themes, grade trajectory.

### Step 3 — Compare and Identify Discrepancies

Cross-reference the two views. Flag any sprint where:

- QA said **PASS** (composite ≥ 3.0) but Critic graded **C or below**
- QA said **FAIL** (composite < 3.0) but Critic graded **B or above**
- A specific criterion scored ≥ 4 by QA but was flagged as weak by Critic (or vice versa)

### Step 4 — Discuss and Align

For each discrepancy:

1. **Identify root cause** — Was QA too lenient? Was Critic applying an unstated standard? Did context differ?
2. **Agree on correct assessment** — If you could re-evaluate, what would the right score/grade be?
3. **Update standards** — Adjust rubric descriptions, scoring anchors, or grade mappings to prevent recurrence.

### Step 5 — Produce Calibration Report

Document outcomes using the template below. File in `docs/companies/sprint-co/quality/calibration-reports/`.

---

## Calibration Report Template

```markdown
# Calibration Report

**Date:** YYYY-MM-DD
**Sprint Range:** S-XX through S-XX
**Participants:** QA Engineer, Critic

## Score Comparison

| Sprint | QA Composite | QA Verdict | Critic Grade | Critic Verdict | Aligned? |
|---|---|---|---|---|---|
| S-XX | X.XX | PASS/FAIL | X | Ship/Revise | ✅/❌ |

## Discrepancies Found

### Discrepancy 1: [Sprint ID] — [Brief description]
- **QA view:** [What QA scored and why]
- **Critic view:** [What Critic graded and why]
- **Root cause:** [Why they disagreed]
- **Resolution:** [Agreed correct assessment]

## Alignment Decisions

- [ ] [Decision 1 — e.g., "Agree that error handling below X standard = Functionality score capped at 3"]
- [ ] [Decision 2]

## Updated Thresholds

| Threshold | Previous | Updated | Reason |
|---|---|---|---|
| [e.g., Min test coverage for Code Quality 4+] | 70% | 80% | Recurring gaps in edge case coverage |

## Action Items

- [ ] [Action 1 — owner, due date]
- [ ] [Action 2 — owner, due date]
```

---

## Escalation

If QA Engineer and Critic cannot reach agreement during calibration:

1. **Document the disagreement** — Each party writes a one-paragraph position statement.
2. **Escalate to Judge** — Judge reviews both positions and the underlying sprint data.
3. **Judge decides** — Judge issues a binding ruling on the standard in question.
4. **Record the ruling** — Add to the calibration report as "Judge Mediation" section.

Judge mediation should be rare. If it happens more than twice in a row, Historian should flag this as a systemic issue in the retrospective.
