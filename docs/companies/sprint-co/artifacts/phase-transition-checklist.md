# Phase Transition Checklists — Sprint Co Enforcer

The Enforcer verifies each checklist before allowing the sprint to advance to the next phase. Every item must be **PASS** for the gate to open. **FAIL** on any item blocks the transition until resolved.

---

## 1. Planning → Architecture

The sprint has a validated plan with stakeholder buy-in.

| # | Requirement | How to Verify | Status |
|---|---|---|---|
| 1.1 | `sprint-plan.md` exists in the sprint artifacts directory | File exists at expected path | [PASS/FAIL] |
| 1.2 | Features list is present | `sprint-plan.md` contains a numbered or bulleted list of features under a "Features" heading | [PASS/FAIL] |
| 1.3 | Each feature has a V-label (V1/V2/V3) | Every feature line includes a `V1`, `V2`, or `V3` tag | [PASS/FAIL] |
| 1.4 | Time estimates are included | Each feature or the plan overall includes hour/minute estimates | [PASS/FAIL] |
| 1.5 | Stakeholder review received | `sprint-plan.md` contains a Stakeholder sign-off section, comment, or approval timestamp | [PASS/FAIL] |

**Gate Result**: [PASS / BLOCKED — list failing items]

---

## 2. Architecture → Build

The plan has been decomposed into actionable, trackable tasks.

| # | Requirement | How to Verify | Status |
|---|---|---|---|
| 2.1 | `task-breakdown.md` exists in the sprint artifacts directory | File exists at expected path | [PASS/FAIL] |
| 2.2 | Tasks have Paperclip issue IDs | Each task row/entry includes a Paperclip issue ID (e.g., `#123`) | [PASS/FAIL] |
| 2.3 | Acceptance criteria defined per task | Each task includes at least one acceptance criterion or "done when" statement | [PASS/FAIL] |
| 2.4 | Tech stack is defined | `task-breakdown.md` or a linked architecture doc specifies languages, frameworks, and key dependencies | [PASS/FAIL] |

**Gate Result**: [PASS / BLOCKED — list failing items]

---

## 3. Build → QA

All build work is complete and ready for evaluation.

| # | Requirement | How to Verify | Status |
|---|---|---|---|
| 3.1 | All assigned tasks have handoff artifacts | Each engineer's assigned tasks have a corresponding handoff note, file, or PR reference | [PASS/FAIL] |
| 3.2 | Self-evaluation scores are present | Engineers have submitted self-eval scores (1-5 per eval criterion) for their completed work | [PASS/FAIL] |
| 3.3 | Code is committed and pushed | Git log shows all work committed to the sprint branch; no uncommitted work-in-progress | [PASS/FAIL] |

**Gate Result**: [PASS / BLOCKED — list failing items]

---

## 4. QA → Deploy

The build has been evaluated and meets the quality bar.

| # | Requirement | How to Verify | Status |
|---|---|---|---|
| 4.1 | `eval-report.md` exists in the sprint artifacts directory | File exists at expected path | [PASS/FAIL] |
| 4.2 | All V1 features have been assessed | Every feature tagged V1 in the sprint plan has a corresponding evaluation entry in the eval report | [PASS/FAIL] |
| 4.3 | Pass threshold met: ≥3.0 average across 4 criteria | Compute the average of all criterion scores in `eval-report.md`; must be ≥ 3.0 | [PASS/FAIL] |
| 4.4 | No CRITICAL bugs remain open | Bug tracker / eval report shows zero open bugs at CRITICAL severity | [PASS/FAIL] |

**Gate Result**: [PASS / BLOCKED — list failing items]

---

## Usage Notes

- The Enforcer fills in the **Status** column at each phase transition.
- If a gate is **BLOCKED**, the Enforcer notifies the responsible agent(s) and logs the block in the [compliance-report.md](./compliance-report.md).
- A blocked gate does not automatically roll back work — it pauses forward progress until the deficiency is resolved.
- The Sprint Lead may request an expedited re-check once the issue is addressed.
