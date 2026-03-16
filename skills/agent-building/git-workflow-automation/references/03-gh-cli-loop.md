# The `gh` CLI Loop

## Prerequisites

```bash
brew install gh        # install
gh auth login          # authenticate (one-time)
gh auth status         # verify: should show your username
```

## Core Commands

### Create a PR

```bash
# Basic
gh pr create --title "feat: add OAuth login" --base main

# Full with body (use HEREDOC for multiline)
gh pr create \
  --title "feat: add OAuth login" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
- Adds OAuth2 login via GitHub provider
- Stores tokens in secure httpOnly cookies

## Test plan
- [ ] Login flow works end-to-end
- [ ] Token refresh handled
- [ ] Logout clears session
EOF
)"

# Draft PR (when work is in progress)
gh pr create --draft --title "wip: OAuth login" --base main
```

### Check PR Status

```bash
# Status of PRs for current branch
gh pr status

# View specific PR
gh pr view 42

# View PR in browser
gh pr view 42 --web

# List all open PRs
gh pr list

# List PRs with filters
gh pr list --state open --assignee @me
gh pr list --state merged --limit 10
```

### Merge a PR

```bash
# Squash merge (recommended for feature branches)
gh pr merge 42 --squash

# Merge merge
gh pr merge 42 --merge

# Rebase merge
gh pr merge 42 --rebase

# Auto-merge when checks pass (non-blocking)
gh pr merge 42 --squash --auto

# Delete branch after merge
gh pr merge 42 --squash --delete-branch
```

### Review and Approve

```bash
# Request review from specific user
gh pr edit 42 --add-reviewer username

# Approve a PR
gh pr review 42 --approve

# Request changes
gh pr review 42 --request-changes --body "Please fix the edge case in auth.ts"

# Leave a comment
gh pr review 42 --comment --body "Looks good overall, minor nit below"
```

### Check and Wait

```bash
# Check CI status on current PR
gh pr checks

# Wait for checks to pass (blocks until done)
gh pr checks --watch

# Get PR number for current branch
gh pr view --json number --jq '.number'
```

## The Full PR Lifecycle (Non-Interactive)

```bash
# 1. Push branch
git push origin feat/my-feature

# 2. Create PR and capture PR number
PR_NUM=$(gh pr create \
  --title "feat: my feature" \
  --base main \
  --body "Auto-generated PR" \
  --json number --jq '.number')

echo "Created PR #$PR_NUM"

# 3. Wait for CI
gh pr checks $PR_NUM --watch

# 4. Merge when ready
gh pr merge $PR_NUM --squash --delete-branch

echo "PR #$PR_NUM merged"
```

## Working With PRs Across Repos

```bash
# Specify repo explicitly
gh pr create --repo owner/repo --title "..."

# View PR in another repo
gh pr view 42 --repo owner/repo

# List PRs in another repo
gh pr list --repo owner/repo
```

## Getting PR Info as JSON

```bash
# All PR fields
gh pr view 42 --json title,body,state,mergeable,reviews

# Just the merge status
gh pr view 42 --json mergeable --jq '.mergeable'

# Extract review decisions
gh pr view 42 --json reviews --jq '.reviews[].state'
```

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `no commits between 'main' and 'feat/x'` | Branch has no changes | Make at least one commit |
| `pull request already exists` | PR open for this branch | Use `gh pr view` to find it |
| `GraphQL: Must have push access` | No write access to repo | Check repo permissions |
| `exit status 1` on `gh pr checks` | CI failed | Check `gh pr checks` output |

## See Also

- [04-branch-strategy.md](04-branch-strategy.md) — branch naming for PRs
- [07-full-loop.md](07-full-loop.md) — complete branch-to-PR-to-merge walkthrough
