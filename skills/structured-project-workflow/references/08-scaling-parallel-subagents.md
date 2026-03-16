# Scaling: Parallel Worktrees and Subagents

## When to Scale

Single context hits its limit when:
- Two independent features can be developed in parallel
- A spec step is large and well-isolated (L size, no cross-step deps)
- You want autonomous execution while you focus elsewhere
- Step parallelization would 2-3x your throughput

**Prerequisites:** Steps are independent. Clear acceptance criteria. CLAUDE.md invariants established. You've done at least one step manually (understand the loop before delegating it).

## Pattern 1: Git Worktrees for Parallel Features

Run two spec steps simultaneously in isolated worktrees:

```bash
# Create worktrees for parallel steps
git worktree add ../project-step3 -b feature/step3
git worktree add ../project-step4 -b feature/step4

# Launch Claude in each (two terminal windows)
# Window 1:
cd ../project-step3
claude  # → work on Step 3

# Window 2:
cd ../project-step4
claude  # → work on Step 4

# Each has its own working directory, no git conflicts
# Merge both back when done:
git checkout main
git merge feature/step3
git merge feature/step4
```

Each worktree is isolated. Both read from the same CLAUDE.md and TASK.md on the main branch.

Full worktree mechanics: see skill #005 (git-workflow-automation).

## Pattern 2: Subagent Delegation for Routine Steps

Delegate an implementation step to a subagent from within Claude Code:

```
Prompt to Claude Code:
"Spawn a subagent to implement Step 4.

Include in the subagent prompt:
- Full contents of CLAUDE.md (project invariants — they MUST follow these)
- Full contents of TASK.md Step 4 (acceptance criteria)
- Instructions to: implement, run bun test, verify all criteria, update TASK.md Step 4 to done
- Return JSON: { stepDone: 4, testsPass: true, criteriaVerified: ['criterion 1', 'criterion 2'] }
- If blocked: { blocked: true, reason: '...' }
"
```

**Critical:** Subagents don't inherit CLAUDE.md. Always include invariants explicitly in the subagent prompt.

Full multi-agent coordination patterns: see skill #003.

## Pattern 3: Orchestrator + Implementers

For a multi-feature release with independent steps:

```
You (Orchestrator)
├── Subagent A → Step 3 (auth refactor)  → branch: feature/step3
├── Subagent B → Step 4 (dashboard)      → branch: feature/step4
├── Subagent C → Step 5 (API layer)      → branch: feature/step5
└── Wait for all 3 JSON summaries
    → validate criteria verified
    → merge all branches
    → run full test suite
    → ship
```

Rules:
- Orchestrator holds CLAUDE.md invariants. Pass them to every subagent.
- Subagents write to separate branches. Orchestrator merges.
- Each subagent returns a JSON summary. Orchestrator validates before merge.
- If a subagent returns `blocked`, orchestrator handles escalation — don't let it stall silently.

## When NOT to Scale

| Scenario | Why Not |
|---|---|
| Steps have dependencies on each other | Parallel work = merge conflicts and broken builds |
| Acceptance criteria are unclear | Subagent will drift. Specify first. |
| CLAUDE.md invariants not written | Subagents have no guardrails — skip this until invariants exist |

## Checklist: Ready to Scale

- [ ] CLAUDE.md invariants written and clear
- [ ] TASK.md steps are independent (no unresolved deps between parallel steps)
- [ ] Acceptance criteria for each step are testable and explicit
- [ ] You've done at least one step manually (understand the loop)
- [ ] Worktree or subagent setup tested on a trivial step first
