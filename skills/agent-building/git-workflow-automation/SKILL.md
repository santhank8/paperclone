---
name: git-workflow-automation
category: dev-workflow
description: Automate the full git workflow in Claude Code — worktrees for parallel agent isolation, gh CLI for PRs, hooks for auto-commits, and the complete branch-to-merge loop. Use when hitting git lock errors with parallel agents, creating PRs from within Claude Code, setting up automated git workflows, or running multi-agent sessions safely. Triggers on: "git worktrees", "parallel agents git", "gh cli claude code", "git lock fix", "automated PR", "git lock error", "branch to PR", "full git loop", "multi-agent git isolation". NOT for: basic git tutorials, GitHub Actions CI setup, GitLab/Bitbucket workflows.
---

# Git Workflow Automation

Git + multi-agent Claude Code = a race condition. Two agents, one working tree, shared refs — `fatal: unable to lock ref`. The fix: `git worktree add` + `gh pr create`, looping branch → commit → PR → merge → cleanup. No human needed.

## Quick Entry

| Goal | Reference |
|---|---|
| Fix git lock errors right now | [01-why-it-breaks.md](references/01-why-it-breaks.md) |
| Isolate parallel agents with worktrees | [02-worktrees.md](references/02-worktrees.md) |
| Create and merge PRs from Claude Code | [03-gh-cli-loop.md](references/03-gh-cli-loop.md) |
| Branch naming and lifecycle strategy | [04-branch-strategy.md](references/04-branch-strategy.md) |
| Auto-commit hooks (PreToolUse, Stop) | [05-hooks.md](references/05-hooks.md) |
| Complete end-to-end loop walkthrough | [07-full-loop.md](references/07-full-loop.md) |

## Core Pattern

```bash
# Each agent gets its own worktree — zero lock contention
git worktree add /tmp/worktree-agent-a feat/task-a
git worktree add /tmp/worktree-agent-b feat/task-b

# Each creates its PR, then cleans up
gh pr create --title "feat: task-a" --body "..." --base main
git worktree remove /tmp/worktree-agent-a
```

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "It's a small change, I'll just commit to main." | Every agent committing to main is one race condition away from a corrupted history. |
| "Worktrees are overkill for parallel agents." | They're the only thing that prevents lock errors — not an optimization, a requirement. |
| "I don't need a branch for a one-file change." | The branch isn't for the diff, it's for the review gate and the clean revert path. |
| "I'll skip the pre-commit hook just this once." | Hooks exist because "just this once" is the exact moment the bad commit lands. |
| "The commit message doesn't matter for this quick fix." | It matters the moment you need to bisect, revert, or explain what broke production. |
