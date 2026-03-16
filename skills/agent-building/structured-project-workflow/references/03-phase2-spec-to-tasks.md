# Phase 2: Spec → Task Breakdown

## What This Phase Does

Reads the PRD and produces TASK.md: a set of sequential, implementation-ready steps with acceptance criteria and status tracking.

This is the bridge between "what we're building" and "the specific thing Claude Code does next."

## TASK.md Structure

```markdown
# [Project Name] — Task List

## Status
- **Phase:** 3 (Implementation)
- **Last Updated:** [date]
- **Active Step:** Step 3

---

## Step 1: [Title]
**Status:** done ✓
**Acceptance Criteria:**
- [x] Criterion 1
- [x] Criterion 2
**Notes:** Completed [date]. [Any decisions made during implementation.]

---

## Step 2: [Title]
**Status:** done ✓
...

---

## Step 3: [Title — current]
**Status:** in_progress
**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
**Notes:** [Current blockers, decisions, context for next session]

---

## Step 4: [Title]
**Status:** todo
**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
**Depends on:** Step 3

---

## Backlog
- [Future idea or stretch goal — not currently scoped]
```

## How to Decompose a PRD into Steps

In plan mode, with PRD.md open:
> "Based on this PRD, create a TASK.md with sequential implementation steps. Each step should take 1-3 hours of implementation. Include acceptance criteria for each step. Order by dependency."

Rules for good steps:
- **One concern per step** — "Set up auth" is one step. "Set up auth and build dashboard" is two.
- **Testable acceptance criteria** — Not "auth works" but "user can sign in and sign out, session persists on refresh"
- **Explicit dependencies** — If Step 5 requires Step 3 output, say so
- **Estimated size** — Tag steps as S/M/L to flag outliers

## Size Guidelines

| Size | Scope | What to do if it's bigger |
|---|---|---|
| S | < 2 files, < 1 hour | Execute directly |
| M | 3-5 files, 1-3 hours | Execute with plan mode |
| L | 5+ files, 3+ hours | Break into multiple steps |
| XL | Multiple L steps | It's a phase, not a step — restructure |

## Anti-Patterns

**Steps without acceptance criteria:** "Implement auth" — how do you know it's done?
**Single mega-step:** "Build the whole API layer" — too big, Claude drifts mid-step
**Steps that skip dependencies:** Step 6 assumes Step 3 output but no dependency marked
**Acceptance criteria that can't be verified:** "Code is clean" — not a criterion

## Checklist: Phase 2 Complete

- [ ] TASK.md exists with all PRD features broken into steps
- [ ] Every step has 2+ acceptance criteria
- [ ] Dependencies between steps are explicit
- [ ] Steps are S or M size (L → break it down)
- [ ] Status on each step is set to `todo`
