# Test Cases: git-workflow-automation

## Trigger Tests (Should Fire)

| # | Prompt | Expected: Triggers? | Assertion |
|---|--------|---------------------|-----------|
| T1 | "Set up git worktrees for parallel agents" | YES | Opens skill, goes to 02-worktrees.md |
| T2 | "How do I create a PR from within Claude Code using gh cli?" | YES | Opens skill, goes to 03-gh-cli-loop.md |
| T3 | "My parallel Claude agents are hitting git lock errors" | YES | Opens skill, goes to 01-why-it-breaks.md |
| T4 | "Automate my git workflow: branch, commit, PR, merge" | YES | Opens skill, shows full loop |
| T5 | "git lock fix multi-agent setup" | YES | Opens skill, diagnoses lock error |
| T6 | "Set up a Stop hook to save WIP commits before session ends" | YES | Opens skill, goes to 05-hooks.md |
| T7 | "branch to PR loop in Claude Code" | YES | Opens skill, goes to 07-full-loop.md |
| T8 | "gh cli parallel agents git isolation" | YES | Opens skill, covers worktrees + gh |

## No-Fire Tests (Should NOT Trigger)

| # | Prompt | Expected: Triggers? | Assertion |
|---|--------|---------------------|-----------|
| N1 | "How do I set up GitHub Actions CI for my project?" | NO | Different skill (CI/CD) |
| N2 | "Explain git merge vs. rebase" | NO | Generic git education, not Claude Code automation |
| N3 | "Set up a GitLab workflow" | NO | Explicitly out of scope (GitLab) |
| N4 | "How does git work?" | NO | Too basic — excluded by NOT clause |
| N5 | "Create a GitHub repo" | NO | Repo setup, not workflow automation |

## Output Assertions

For each trigger test, verify the output:

**T1 — Worktree setup:**
- [ ] Provides `git worktree add` command with correct syntax
- [ ] Explains agent-per-worktree pattern
- [ ] Covers cleanup (`git worktree remove`)

**T2 — PR creation:**
- [ ] Shows `gh pr create` command with all key flags
- [ ] Covers `gh pr merge --squash --delete-branch`
- [ ] Includes how to capture PR number

**T3 — Lock errors:**
- [ ] Shows the exact error message
- [ ] Explains root cause (shared working tree)
- [ ] Provides worktree solution, not just "retry"

**T4 — Full automation loop:**
- [ ] Shows all 8 steps from branch to cleanup
- [ ] Every command is copy-pasteable
- [ ] Includes commit co-author format

**T5 — Lock fix:**
- [ ] Correctly diagnoses shared state as cause
- [ ] Does NOT suggest retrying
- [ ] Points to worktree isolation as fix

**T6 — Stop hook:**
- [ ] Provides valid JSON for `.claude/settings.json`
- [ ] Hook command uses `git diff --quiet` guard
- [ ] Uses `--no-verify` flag on WIP commits

**T7 — Full loop:**
- [ ] References 07-full-loop.md
- [ ] Includes branch naming convention
- [ ] Covers cleanup step

**T8 — Combined:**
- [ ] Addresses both worktree isolation AND gh CLI
- [ ] Shows how they compose into a complete workflow

## Scoring

Pass rate target: 80%+ (trigger + output combined)

Scoring:
- Trigger test: 1 point per correct result (YES fires / NO doesn't fire)
- Output test: 1 point per assertion passed
- Total: 8 trigger + ~20 output assertions = 28 points max
- Pass threshold: 22/28 (79%)
