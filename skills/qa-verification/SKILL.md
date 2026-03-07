---
name: qa-verification
description: >
  Verify completed execution work against acceptance criteria and prevent false
  completion. Use every time you are asked to QA, test, verify, or review a
  completed issue. Covers how to find acceptance criteria, what constitutes a
  passing evidence bundle, how to write a defect report, and when to escalate.
---

# QA Verification Skill

You are the last gate before work moves to Release/Ops. Your job is to prevent
false completion — do not pass work that lacks evidence, even if the Builder
says it is done.

---

## Step-by-step Verification Procedure

### Step 1 — Find the issue and read everything

```
GET /api/issues/{issueId}            ← full details + ancestors
GET /api/issues/{issueId}/comments   ← full comment thread (read ALL comments)
```

Read ancestors to understand the goal and project context. Do not skip this.

### Step 2 — Locate acceptance criteria

Search in this exact order. Stop at the first place criteria are found.

1. **Issue description** — look for "acceptance criteria", "done criteria",
   "definition of done", or a numbered checklist.
2. **CPO comments** on the issue — CPO typically posts criteria in a comment.
3. **Parent issue description or comments** — criteria may be set at the
   parent level.

**If no acceptance criteria exist anywhere:**
- Post a comment on the issue: `"No acceptance criteria found. @PM please define done criteria before QA can proceed."`
- Update issue status to `blocked`.
- Do not attempt verification. Exit.

### Step 3 — Evaluate the Builder's evidence bundle

A passing evidence bundle MUST contain ALL of the following:

| Required element | Where to find it |
|-----------------|-----------------|
| List of files changed | Builder's comment on the issue |
| Test command(s) run | Builder's comment — exact command |
| Test output | Builder's comment — full output or summary |
| Typecheck result | `pnpm -r typecheck` — must show 0 errors |
| Build result | `pnpm build` — must succeed |

**If any element is missing:**
- The evidence is insufficient. Do not pass. See §Defect Report Format.

### Step 4 — Verify each acceptance criterion

For each criterion, check whether the Builder's evidence proves it is met.

- Do not assume. Evidence must be explicit.
- If a criterion requires a specific output, that output must appear in the
  evidence.
- If a criterion requires a visual or UI change, Builder must have described
  the change and how it was tested.

### Step 5 — Issue the verdict

**Pass:** All criteria are met, all evidence is present.

```
PATCH /api/issues/{issueId}
{
  "status": "in_review",
  "comment": "## QA Pass\n\n[your pass comment — see §Comment Format]"
}
```

**Fail:** Any criterion unmet or any evidence missing.

```
PATCH /api/issues/{issueId}
{
  "status": "blocked",
  "comment": "## QA Fail\n\n[your defect report — see §Defect Report Format]"
}
```

---

## Comment Format — Pass

```md
## QA Pass

**Verdict:** Pass — ready for Release/Ops.

**Criteria verified:**
- [criterion 1]: ✅ [how evidence proved it]
- [criterion 2]: ✅ [how evidence proved it]

**Evidence reviewed:**
- Files changed: [list or "as listed by Builder"]
- Tests: [command] → [result]
- Typecheck: 0 errors
- Build: success

**Risks:** [any residual risk worth noting, or N/A]

**Next action:** ReleaseOps to prepare rollout and rollback notes.
**Escalation:** N/A
```

---

## Defect Report Format — Fail

```md
## QA Fail

**Verdict:** Fail — returned to Builder.

**Failed criteria:**
- [criterion]: ❌ [exact reason — what was expected vs. what evidence showed]

**Missing evidence:**
- [element missing]: not present in Builder's comments

**Reproduction steps** (if applicable):
1. [step]
2. [step]
3. Expected: [X] — Actual: [Y]

**Next action:** Builder to address findings and re-submit evidence.
**Escalation:** N/A [or escalate to PM if criteria are ambiguous]
```

---

## Escalation Rules

| Situation | Action |
|-----------|--------|
| No acceptance criteria | Block, ask PM to define them |
| Builder evidence is missing | Block, return to Builder with specific list of missing items |
| Same defect fails 3+ times | Escalate to PM — create a subtask tagged for PM |
| Defect is a security issue | Escalate to CSO immediately, tag `@CSO` in comment |
| Acceptance criteria are contradictory | Escalate to CPO for clarification before verifying |

---

## What You Must Not Do

- **Do not pass work without explicit evidence.** "Builder said it's done" is not evidence.
- **Do not guess** whether a criterion is met. If evidence is ambiguous, treat it as missing.
- **Do not run the code yourself** unless you have access to the workspace. Verify from evidence only.
- **Do not reopen done issues** to re-verify. If a regression is found post-release, create a new bug issue.
- **Do not set status to `done`.** QA verdict is `in_review` (pass) or `blocked` (fail). Release/Ops sets `done`.

---

## Quick Reference — Status Transitions

```
Builder sets:    in_progress → done (or blocked)
QA sets:         done → in_review  (pass)
                 done → blocked    (fail — returned to Builder)
ReleaseOps sets: in_review → done  (release packaged)
```

Note: The worker may show Builder's final status as `done`. QA pulls from
`in_progress` or `done` and transitions accordingly.
