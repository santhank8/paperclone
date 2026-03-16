# Phase 3: The Implementation Loop

## What This Phase Does

Executes each TASK.md step through the plan-approve-execute cycle. Each step:
1. Plan mode → Claude proposes approach
2. You approve (or adjust scope)
3. Execute → Claude implements, verifies, runs tests
4. Update TASK.md → step done, notes captured

## The Loop (per step)

```
START STEP N
  ↓
Plan mode: "Let's implement Step N: [title]. Read TASK.md step N and CLAUDE.md.
Propose the implementation approach."
  ↓
You review + approve (or reject and re-scope)
  ↓
Exit plan mode: "Implement it."
  ↓
Claude: edits files, runs tests, verifies build
  ↓
Claude: proposes "Step N acceptance criteria: all met. Marking done."
  ↓
You: check the criteria, approve
  ↓
PATCH TASK.md: Step N status → done, add notes
  ↓
NEXT STEP
```

## Session Start Handoff

Start every session:
> "Read CLAUDE.md and TASK.md. Tell me the current phase, active step, and any blockers from last session."

Claude reads, reports. You continue from the correct position. No context re-explaining.

## Session End Handoff

End every session (update TASK.md):
```markdown
## Step 3: [Title]
**Status:** in_progress
**Notes:** [date] — implemented X, Y. Blocked on Z. Next session: finish Y, test with real data.
```

The notes in TASK.md ARE your session handoff. Future-you (and future-Claude) picks it up cleanly.

## When Claude Drifts

Signs of drift:
- Implementing features not in the current step's acceptance criteria
- Changing files not related to the current step
- Making architecture decisions that contradict CLAUDE.md invariants

When you see drift:
1. Stop. Don't approve.
2. Point to the specific CLAUDE.md invariant or TASK.md acceptance criterion being violated.
3. Return to plan mode. Re-scope.

## Unattended Execution (Autonomous Mode)

For well-specified steps (M size, clear criteria, no ambiguity):
> "Implement Step N through Step M autonomously. Verify criteria, update TASK.md, proceed. Pause at Step M+1 for review."

Only use when criteria are explicit, step is correctly scoped, and you've reviewed plan mode output first.

## Checklist: Per Step Done

- [ ] All acceptance criteria verified (not assumed)
- [ ] Build passes (no new errors introduced)
- [ ] Tests written and passing for new behavior
- [ ] No CLAUDE.md invariants violated
- [ ] TASK.md status updated to done with notes
