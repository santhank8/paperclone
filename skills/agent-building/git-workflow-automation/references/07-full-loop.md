# The Full Loop: Branch to Merged PR

Complete end-to-end walkthrough. Every command, every decision point, fully automated.

## Setup (One-Time Per Session)

```bash
# Verify starting state
git status                          # should be clean
git branch --show-current          # should be main
git pull origin main               # get latest

# Create branch + worktree
TASK_ID="AIS-13"
TASK_SLUG="git-workflow-automation"
BRANCH="feat/${TASK_ID}-${TASK_SLUG}"
WORKTREE="/tmp/wt-${TASK_ID,,}-${TASK_SLUG}"

git worktree add -b "$BRANCH" "$WORKTREE" main

echo "Working in: $WORKTREE"
echo "Branch: $BRANCH"
```

## Step 1: Branch Created

```bash
# Verify
cd "$WORKTREE"
git branch --show-current          # should show feat/AIS-13-git-workflow-automation
git log --oneline -3               # should match main
```

## Step 2: Implement

Claude Code works in `$WORKTREE`. All file edits happen here — isolated from other agents.

If using hooks from [05-hooks.md](05-hooks.md), files are auto-staged after each write.

## Step 3: Commit

```bash
# Stage (if not using auto-stage hook)
git add -A

# Review what's staged
git diff --staged --stat

# Commit with co-author
git commit -m "feat(${TASK_ID}): implement ${TASK_SLUG}

Brief description of what was implemented and why.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Commit Message Format

```
{type}({scope}): {summary}

{body — what and why, not how}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

## Step 4: Push

```bash
git push origin "$BRANCH"
```

If branch already has a PR open (resuming work):
```bash
git push origin "$BRANCH"          # updates existing PR automatically
```

## Step 5: Create PR

```bash
PR_NUM=$(gh pr create \
  --title "feat(${TASK_ID}): ${TASK_SLUG}" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
- [What was built]
- [Key decisions made]

## Test plan
- [ ] [Test 1]
- [ ] [Test 2]

🤖 Generated with Claude Code
EOF
)" \
  --json number --jq '.number')

echo "Created PR #${PR_NUM}: $(gh pr view $PR_NUM --json url --jq '.url')"
```

## Step 6: Wait for CI (Optional)

```bash
# Non-blocking: check status
gh pr checks "$PR_NUM"

# Blocking: wait until all checks pass
gh pr checks "$PR_NUM" --watch

# If checks fail: diagnose
gh pr checks "$PR_NUM" | grep -v "pass"
```

## Step 7: Merge

```bash
# Squash merge (recommended — clean main history)
gh pr merge "$PR_NUM" --squash --delete-branch

# Verify merged
gh pr view "$PR_NUM" --json state --jq '.state'   # should be "MERGED"
```

## Step 8: Cleanup

```bash
# Remove worktree
cd ~   # must not be inside the worktree directory
git worktree remove "$WORKTREE"

# Prune if needed
git worktree prune

# Update local main
git checkout main
git pull origin main

# Verify branch is gone
git branch | grep "$BRANCH"    # should return nothing
```

## Full Script (Copy-Paste Ready)

```bash
#!/bin/bash
set -euo pipefail

TASK_ID="${1:?Usage: ./git-loop.sh TASK_ID TASK_SLUG}"
TASK_SLUG="${2:?Usage: ./git-loop.sh TASK_ID TASK_SLUG}"
BRANCH="feat/${TASK_ID}-${TASK_SLUG}"
WORKTREE="/tmp/wt-${TASK_ID,,}"

echo "=== SETUP ==="
git pull origin main
git worktree add -b "$BRANCH" "$WORKTREE" main
echo "Worktree: $WORKTREE | Branch: $BRANCH"

echo "=== IMPLEMENT ==="
echo "Do your work in: $WORKTREE"
echo "Press Enter when ready to commit..."
read

echo "=== COMMIT ==="
cd "$WORKTREE"
git add -A
git commit -m "feat(${TASK_ID}): ${TASK_SLUG}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin "$BRANCH"

echo "=== PR ==="
PR_NUM=$(gh pr create \
  --title "feat(${TASK_ID}): ${TASK_SLUG}" \
  --base main \
  --json number --jq '.number')
echo "PR #${PR_NUM} created"

echo "=== MERGE ==="
gh pr checks "$PR_NUM" --watch
gh pr merge "$PR_NUM" --squash --delete-branch
echo "PR #${PR_NUM} merged"

echo "=== CLEANUP ==="
cd ~
git worktree remove "$WORKTREE"
git checkout main
git pull origin main
echo "Done."
```

## Decision Points

| State | Check | Action |
|---|---|---|
| `git status` shows untracked files | Files weren't staged | `git add -A` |
| `gh pr checks` fails | CI error | Fix the error, push again |
| `gh pr merge` blocked | PR requires review | Request review, wait |
| Merge conflict on rebase | Diverged from main | See [06-conflict-resolution.md](06-conflict-resolution.md) |
| Worktree remove fails | Still inside worktree dir | `cd ~` first, then remove |

## Parallel Two-Agent Example

```bash
# Setup both
git worktree add -b feat/auth-frontend /tmp/wt-frontend main
git worktree add -b feat/auth-backend  /tmp/wt-backend  main

# Agent A: frontend work in /tmp/wt-frontend
# Agent B: backend work in /tmp/wt-backend
# Both commit and push independently

# Both create PRs
# (run in parallel — each agent owns its PR)

# Merge order: backend first (frontend depends on it)
gh pr merge $BACKEND_PR --squash --delete-branch
gh pr merge $FRONTEND_PR --squash --delete-branch

# Cleanup both
git worktree remove /tmp/wt-frontend
git worktree remove /tmp/wt-backend
```
