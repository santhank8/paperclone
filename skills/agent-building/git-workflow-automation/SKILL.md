---
name: git-workflow-automation
category: dev-workflow
description: Automate the full git workflow in Claude Code — worktrees for parallel agent isolation, gh CLI for PRs, hooks for auto-commits, and the complete branch-to-merge loop. Use when hitting git lock errors with parallel agents, creating PRs from within Claude Code, setting up automated git workflows, or running multi-agent sessions safely. Triggers on: "git worktrees", "parallel agents git", "gh cli claude code", "git lock fix", "automated PR", "git lock error", "branch to PR", "full git loop", "multi-agent git isolation". NOT for: basic git tutorials, GitHub Actions CI setup, GitLab/Bitbucket workflows.
---

# Git Workflow Automation

Git + multi-agent Claude Code = a race condition waiting to happen. Two agents, one working tree, shared refs — someone hits `fatal: unable to lock ref` and everything stops.

The fix is two commands: `git worktree add` and `gh pr create`. The pattern is a loop: branch → implement → commit → PR → merge → cleanup. No human touching a terminal.

## Quick Entry

| Goal | Reference |
|---|---|
| Fix git lock errors right now | [01-why-it-breaks.md](references/01-why-it-breaks.md) |
| Isolate parallel agents with worktrees | [02-worktrees.md](references/02-worktrees.md) |
| Create and merge PRs from Claude Code | [03-gh-cli-loop.md](references/03-gh-cli-loop.md) |
| Branch naming and lifecycle strategy | [04-branch-strategy.md](references/04-branch-strategy.md) |
| Auto-commit hooks (PreToolUse, Stop) | [05-hooks.md](references/05-hooks.md) |
| Conflict resolution without human eyes | [06-conflict-resolution.md](references/06-conflict-resolution.md) |
| Complete end-to-end loop walkthrough | [07-full-loop.md](references/07-full-loop.md) |

## The Core Pattern (30-Second Version)

```bash
# 1. Each agent gets its own worktree
git worktree add /tmp/worktree-agent-a feat/task-a
git worktree add /tmp/worktree-agent-b feat/task-b

# 2. Each agent works in its directory — zero contention
# Agent A: cd /tmp/worktree-agent-a && implement → commit → push
# Agent B: cd /tmp/worktree-agent-b && implement → commit → push

# 3. Both create PRs with gh CLI
gh pr create --title "feat: task-a" --body "..." --base main

# 4. Cleanup
git worktree remove /tmp/worktree-agent-a
```

**Stop hook for WIP commits** (add to `.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "git diff --quiet && git diff --staged --quiet || (git add -A && git commit -m 'wip: checkpoint [auto-stop]' --no-verify)"
      }]
    }]
  }
}
```

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I'll just pull and retry — it'll clear up" | Same working tree = same collision. `git pull` doesn't fix contention. Worktrees do. |
| "Worktrees are complex setup — I'll manage branches manually" | `git worktree add /tmp/wt feat/task` — that's it. 10 seconds. Manual branch sharing takes infinite debugging. |
| "I'll open GitHub to create the PR" | `gh pr create` runs in 15 seconds from within Claude Code. Browser handoff breaks the automation loop. |
| "I can resolve this conflict manually later" | In an automated loop, unresolved conflicts block everything. Escalate immediately or auto-resolve with the stash-rebase pattern. |
| "I don't need a Stop hook — I'll commit at the end" | Sessions end without warning. A Stop hook is insurance. Without it, half-built work lives only in an open terminal. |
| "I'll clean up the worktree and branch later" | Later never comes. Cleanup is step 8 of the loop, not a separate todo. |

## Prerequisites

- `git` (built-in)
- `gh` CLI: `brew install gh && gh auth login`
- Verify: `gh auth status` → should show authenticated user
