# Git Worktrees: The Pattern

## The Commands

```bash
# Add a worktree on a new branch
git worktree add /tmp/worktree-feat-auth feat/auth

# Add a worktree on an existing branch
git worktree add /tmp/worktree-feat-auth feat/auth

# Add a worktree and create the branch in one step
git worktree add -b feat/new-feature /tmp/worktree-new-feature main

# List all active worktrees
git worktree list

# Remove a worktree (after work is done)
git worktree remove /tmp/worktree-feat-auth

# Force remove if branch still has uncommitted changes
git worktree remove --force /tmp/worktree-feat-auth

# Prune stale worktree entries (if directory was deleted manually)
git worktree prune
```

## Where to Put Worktrees

**Recommended: `/tmp/`**
- Ephemeral, auto-cleaned on reboot
- No risk of accidentally committing worktree paths
- Fast local storage

```bash
git worktree add /tmp/wt-$(echo $TASK_ID | tr '/' '-') feat/$TASK_ID
```

**Avoid: sibling directories of the repo**
- `../my-repo-agent-a/` creates nested git complexity
- Can confuse IDE file watchers
- Risk of paths appearing in git status

## Naming Conventions

Structure: `/tmp/wt-{context}-{branch-slug}`

```bash
# By task/issue ID
/tmp/wt-ais-13-git-workflow

# By agent name
/tmp/wt-agent-a-auth

# By timestamp (for ephemeral sessions)
/tmp/wt-$(date +%Y%m%d%H%M%S)-feature-name

# For Claude Code worktrees (matches isolation: "worktree" pattern)
/tmp/worktree-{repo-name}-{short-hash}
```

## The Agent-Per-Worktree Pattern

```bash
# Setup: two agents, two branches, zero contention
git worktree add /tmp/wt-agent-a feat/feature-a main
git worktree add /tmp/wt-agent-b feat/feature-b main

# Agent A works in /tmp/wt-agent-a
# Agent B works in /tmp/wt-agent-b
# Both read/write the same .git/objects — no duplication
# Each has its own HEAD, index, and branch — no contention

# Teardown: after both PRs are merged
git worktree remove /tmp/wt-agent-a
git worktree remove /tmp/wt-agent-b
git branch -d feat/feature-a feat/feature-b
```

## Claude Code's `isolation: "worktree"` Under the Hood

When you pass `isolation: "worktree"` to the Agent tool, Claude Code:
1. Creates a new branch from current HEAD
2. Runs `git worktree add /tmp/{generated-path} {new-branch}`
3. Sets the subagent's working directory to that path
4. Cleans up the worktree after the agent finishes (if no changes were made)

If changes are made, the worktree path and branch are returned in the result — giving you the branch to open a PR against.

```typescript
const result = await Agent({
  isolation: "worktree",
  prompt: "Implement OAuth2 login"
})
// result.worktreePath: "/tmp/worktree-myrepo-abc123"
// result.branch: "worktree/abc123"
```

## Gotchas

| Problem | Cause | Fix |
|---|---|---|
| `fatal: 'feat/x' is already checked out` | Branch active in another worktree | Use a different branch name per worktree |
| `git worktree remove` fails | Uncommitted changes | Commit or stash first, or use `--force` |
| VSCode shows duplicate files | IDE watching both directories | Add `/tmp/wt-*` to workspace exclude |
| Worktree survives reboot but .git ref is stale | Manual directory deletion | Run `git worktree prune` |

## See Also

- [01-why-it-breaks.md](01-why-it-breaks.md) — why shared working trees fail
- [07-full-loop.md](07-full-loop.md) — worktrees in the full automation loop
