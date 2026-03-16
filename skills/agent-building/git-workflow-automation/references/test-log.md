# Test Log: git-workflow-automation

## Iteration 0 — Initial Drafting

**Date:** 2026-03-15
**Status:** Drafted — not yet tested
**Score:** Pending

### Files Created
- `SKILL.md` — main skill file
- `references/01-why-it-breaks.md`
- `references/02-worktrees.md`
- `references/03-gh-cli-loop.md`
- `references/04-branch-strategy.md`
- `references/05-hooks.md`
- `references/06-conflict-resolution.md`
- `references/07-full-loop.md`
- `references/test-cases.md`
- `references/test-log.md`

### Self-Assessment vs. Test Cases

| Test | Type | Predicted Result | Confidence |
|------|------|-----------------|------------|
| T1: "Set up git worktrees for parallel agents" | Trigger | YES | High — "git worktrees" in description |
| T2: "How do I create a PR from within Claude Code using gh cli?" | Trigger | YES | High — "gh cli claude code" in description |
| T3: "My parallel Claude agents are hitting git lock errors" | Trigger | YES | High — "git lock error" in description |
| T4: "Automate my git workflow: branch, commit, PR, merge" | Trigger | YES | High — "automated PR" matches |
| T5: "git lock fix multi-agent setup" | Trigger | YES | High — exact phrase match |
| T6: "Set up a Stop hook to save WIP commits before session ends" | Trigger | YES | Medium — no "Stop hook" in trigger phrases |
| T7: "branch to PR loop in Claude Code" | Trigger | YES | High — "branch to PR" in description |
| T8: "gh cli parallel agents git isolation" | Trigger | YES | High — covers gh CLI + isolation |
| N1: "How do I set up GitHub Actions CI?" | No-fire | NO | High — "NOT for: CI/CD" in description |
| N2: "Explain git merge vs. rebase" | No-fire | NO | Medium — might trigger on "git" |
| N3: "Set up a GitLab workflow" | No-fire | NO | High — "NOT for: GitLab" explicit |
| N4: "How does git work?" | No-fire | NO | Medium — "git" alone shouldn't fire |
| N5: "Create a GitHub repo" | No-fire | NO | High — not about workflow automation |

### Potential Weak Spots

1. **T6 (Stop hook)**: description doesn't mention "hooks" or "stop hook" explicitly — may not trigger on hook-specific queries
2. **N2/N4 (generic git questions)**: "git" keyword could cause false positives if matching is loose

### Improvement Candidates (Pre-Test)

If T6 misses: add "auto-commit hook", "Stop hook", "WIP commit" to description trigger phrases
If N2/N4 fires: strengthen NOT clause to "NOT for: basic git concepts, git tutorials"

---

## Iteration 1 — Live Content Testing

**Date:** 2026-03-15
**Status:** Completed
**Tester:** SkillBuilder (AIS-15)

### Trigger Tests

| Test | Trigger? | Expected? | Pass? | Notes |
|------|----------|-----------|-------|-------|
| T1: "Set up git worktrees for parallel agents" | YES | YES | ✅ | "git worktrees" exact trigger phrase |
| T2: "How do I create a PR from within Claude Code using gh cli?" | YES | YES | ✅ | "gh cli claude code" exact phrase |
| T3: "My parallel Claude agents are hitting git lock errors" | YES | YES | ✅ | "git lock error" phrase match |
| T4: "Automate my git workflow: branch, commit, PR, merge" | YES | YES | ✅ | "automated PR" + "git workflow" match |
| T5: "git lock fix multi-agent setup" | YES | YES | ✅ | "git lock fix" exact phrase |
| T6: "Set up a Stop hook to save WIP commits before session ends" | YES | YES | ✅ | "hooks for auto-commits" in description body |
| T7: "branch to PR loop in Claude Code" | YES | YES | ✅ | "branch to PR" exact phrase |
| T8: "gh cli parallel agents git isolation" | YES | YES | ✅ | "parallel agents git" + "gh cli" both match |
| N1: "How do I set up GitHub Actions CI for my project?" | NO | NO | ✅ | Explicitly excluded: "GitHub Actions CI setup" |
| N2: "Explain git merge vs. rebase" | NO | NO | ✅ | Excluded: "basic git tutorials" |
| N3: "Set up a GitLab workflow" | NO | NO | ✅ | Explicitly excluded: "GitLab/Bitbucket workflows" |
| N4: "How does git work?" | NO | NO | ✅ | Excluded: "basic git tutorials" |
| N5: "Create a GitHub repo" | NO | NO | ✅ | No trigger phrase match, not workflow automation |

**Trigger score: 13/13**

### Output Assertions

| Test | Assertion | Pass? | Notes |
|------|-----------|-------|-------|
| T1 | `git worktree add` correct syntax | ✅ | SKILL.md: `git worktree add /tmp/worktree-agent-a feat/task-a` |
| T1 | Agent-per-worktree pattern explained | ✅ | SKILL.md + 02-worktrees.md |
| T1 | Covers cleanup (`git worktree remove`) | ✅ | SKILL.md has `git worktree remove /tmp/wt-...` |
| T2 | Shows `gh pr create` with key flags | ✅ | 03-gh-cli-loop.md: `--title`, `--base`, `--body`, `--json number` |
| T2 | Covers `gh pr merge --squash --delete-branch` | ✅ | 03-gh-cli-loop.md line 75: exact command present |
| T2 | Includes how to capture PR number | ✅ | 03-gh-cli-loop.md: `PR_NUM=$(gh pr create ... --json number --jq '.number')` |
| T3 | Shows exact error message | ✅ | 01-why-it-breaks.md: `fatal: Unable to lock ref 'refs/heads/...'` |
| T3 | Explains root cause (shared working tree) | ✅ | 01-why-it-breaks.md: "Two Claude Code agents running in the same working directory" |
| T3 | Worktree solution (not just "retry") | ✅ | 01-why-it-breaks.md: "Why Retrying Doesn't Help" + fix section |
| T4 | Shows all 8 steps branch to cleanup | ✅ | 07-full-loop.md: Setup + Steps 1-8 complete |
| T4 | Every command copy-pasteable | ✅ | 07-full-loop.md: Full script with `set -euo pipefail` |
| T4 | Commit co-author format included | ✅ | 07-full-loop.md: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` |
| T5 | Diagnoses shared state as root cause | ✅ | SKILL.md anti-rationalization + 01-why-it-breaks.md |
| T5 | Does NOT suggest retrying | ✅ | 01-why-it-breaks.md: "Why Retrying Doesn't Help" explicit section |
| T5 | Points to worktree isolation as fix | ✅ | 01-why-it-breaks.md: "The Fix: Git Worktrees" |
| T6 | Valid JSON for `.claude/settings.json` | ✅ | SKILL.md + 05-hooks.md full JSON |
| T6 | Hook uses `git diff --quiet` guard | ✅ | SKILL.md (fixed) + 05-hooks.md: `git diff --quiet && git diff --staged --quiet` |
| T6 | Uses `--no-verify` on WIP commits | ✅ | SKILL.md (fixed) + 05-hooks.md: `commit -m 'wip: ...' --no-verify` |
| T7 | References 07-full-loop.md | ✅ | SKILL.md Quick Entry table: "Complete end-to-end loop walkthrough → 07-full-loop.md" |
| T7 | Includes branch naming convention | ✅ | 07-full-loop.md: `BRANCH="feat/${TASK_ID}-${TASK_SLUG}"` |
| T7 | Covers cleanup step | ✅ | 07-full-loop.md: Step 8 Cleanup with worktree remove + branch verify |
| T8 | Addresses both worktree isolation AND gh CLI | ✅ | SKILL.md covers both, 02-worktrees.md + 03-gh-cli-loop.md |
| T8 | Shows how they compose into complete workflow | ✅ | 07-full-loop.md parallel two-agent example |

**Output score: 23/23**

### Fix Applied in Iteration 1

**SKILL.md Stop hook example updated:** Inline example was simplified version missing `--no-verify` and `git diff --staged --quiet`. Updated to match the authoritative version in 05-hooks.md:
- Before: `git diff --quiet || (git add -A && git commit -m 'wip: checkpoint [auto]')`
- After: `git diff --quiet && git diff --staged --quiet || (git add -A && git commit -m 'wip: checkpoint [auto-stop]' --no-verify)`

### Final Score

| Category | Score | Points |
|----------|-------|--------|
| Trigger tests (T1–T8) | 8/8 | 8 |
| No-fire tests (N1–N5) | 5/5 | 5 |
| Output assertions | 23/23 | 23 |
| **Total** | **36/36** | **100%** |

**Pass threshold:** 22/28 (79%) — **PASSES ✅**
**Action:** Ship. QC resubmit.
