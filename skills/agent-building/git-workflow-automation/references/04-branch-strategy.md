# Branch Strategy for Claude Code

## Naming Convention

Structure: `{type}/{context}-{slug}`

```
feat/AIS-13-git-workflow-automation
fix/AIS-14-lock-contention-race
refactor/auth-extract-token-logic
wip/claude-session-20260315-oauth
agent/2dde30cb-feature-login
```

### Type Prefixes

| Prefix | Use |
|---|---|
| `feat/` | New feature work |
| `fix/` | Bug fix |
| `refactor/` | Code restructure, no behavior change |
| `chore/` | Dependency updates, config changes |
| `wip/` | In-progress Claude session, not yet a PR |
| `agent/` | Worktree-isolated agent branch |

### Context Field

Include the issue/task identifier when available — makes `gh pr list` and git log scannable without opening GitHub:

```bash
feat/AIS-13-git-workflow   # Paperclip issue AIS-13
feat/GH-42-add-auth        # GitHub issue #42
fix/JIRA-1234-null-check   # Jira ticket
```

## Branch-Per-Task Rule

**One branch per task, not per session.** A Claude Code session might span multiple commits — they all go on the same task branch. A new task = new branch.

```bash
# Right: one branch tracks one unit of work
feat/add-oauth              # all commits for OAuth work go here

# Wrong: new branch every time you open Claude Code
feat/add-oauth-session-1    # same work, fragmented history
feat/add-oauth-session-2
feat/add-oauth-session-3
```

## When to Reuse vs. Create Fresh

**Reuse the existing branch when:**
- Same task, continuing work from a previous session
- Adding to a PR that's already open and under review
- Fixing review feedback on an existing PR

```bash
# Resume work on existing branch
git worktree add /tmp/wt-resume feat/add-oauth
# Commit and push to same PR
git push origin feat/add-oauth
```

**Create a fresh branch when:**
- New task or issue (even if similar)
- Previous branch was merged or abandoned
- Scope changed enough to warrant a new PR

```bash
git worktree add -b feat/add-oauth-v2 /tmp/wt-new main
```

## Keep Main Clean

Rules:
1. **Never work directly on `main`** — the PreToolUse hook in [05-hooks.md](05-hooks.md) enforces this
2. **Never push directly to `main`** — all changes go through PRs
3. **Delete branches after merge** — `gh pr merge --delete-branch` handles this

```bash
# Verify you're not on main before starting
git branch --show-current  # should never be "main" or "master"
```

## Multi-Agent Branch Strategy

When running parallel agents, each gets a dedicated branch:

```bash
# Two agents, two branches, same base
git worktree add -b feat/auth-frontend /tmp/wt-frontend main
git worktree add -b feat/auth-backend /tmp/wt-backend main

# Agent A works on feat/auth-frontend
# Agent B works on feat/auth-backend

# Both create independent PRs
# Merge order matters — backend first if frontend depends on it
```

## Branch Lifecycle

```
main
  └── feat/task-name      ← created from main
        └── [commits]     ← Claude Code works here
        └── [PR opened]   ← gh pr create
        └── [merged]      ← gh pr merge --delete-branch
  └── (back to main)      ← git worktree remove → done
```

## Naming Gotchas

| Problem | Fix |
|---|---|
| Branch already exists in another worktree | Use unique name suffix (`-v2`, `-retry`) |
| Slash in issue ID breaks some tools | Replace `/` with `-` in branch name |
| Branch too long for terminal display | Shorten slug to 3-4 words max |
| GitHub PR title auto-populated from branch | Use descriptive, human-readable slugs |
