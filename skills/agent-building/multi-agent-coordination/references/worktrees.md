# Git Worktree Isolation for Parallel Agents

## Why Worktrees

Naive parallel agents on the same branch hit:
- **Git config lock contention** — concurrent `git config` writes fail with "File already locked"
- **Build collisions** — parallel builds writing the same output paths
- **Merge conflicts** — agent A and agent B both edit `utils.ts`, last write wins

Worktrees give each agent its own branch and directory. No shared git state.

## Lifecycle

```bash
# 1. Setup — before spawning agents
git worktree add /tmp/agent-logic -b agent/review-logic
git worktree add /tmp/agent-security -b agent/review-security

# 2. Spawn agents with their worktree paths
# (include in spawn prompt: "Your working directory is /tmp/agent-logic")

# 3. Agents work in isolation — no cross-contamination

# 4. Merge results back
git -C /path/to/main merge agent/review-logic --no-ff -m "Merge logic review"
git -C /path/to/main merge agent/review-security --no-ff -m "Merge security review"

# 5. Cleanup
git worktree remove /tmp/agent-logic
git worktree remove /tmp/agent-security
git branch -d agent/review-logic agent/review-security
```

## Naming Conventions

- Branches: `agent/[task-name]-[timestamp]` — avoids collisions across sessions
- Worktree paths: `/tmp/agent-[task-name]` — clearly temporary
- Never use `main`/`master` as a worktree base for agent branches

## Spawn Prompt Template

```markdown
Your working directory is /tmp/agent-[name].
This is an isolated git worktree on branch agent/[name].
Do NOT switch branches or modify git config.
When done, your changes will be on this branch for the orchestrator to merge.
```

## Conflict Patterns and Fixes

| Pattern | Symptom | Fix |
|---------|---------|-----|
| Both agents edit same file | Merge conflict on orchestrator merge | Different agents own different files — enforce in manifest |
| Agent switches branches | Other agents see unexpected state | Add "do not switch branches" to spawn prompt |
| Agent forgets to stage changes | Merge sees nothing | "Commit all changes before reporting done" in spawn prompt |
| Worktree already exists | `git worktree add` fails | Use timestamp suffix: `agent/logic-20260315` |

## Cleanup Automation

Add to orchestrator after all agents report done:

```bash
for dir in /tmp/agent-*; do
  branch=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null)
  git worktree remove "$dir" --force 2>/dev/null
  git branch -d "$branch" 2>/dev/null
done
```

## When Worktrees Aren't Needed

Skip worktrees when agents are read-only (scouts, analyzers). Worktrees matter for agents that write to disk or git. If the agent only reads files and returns a report, no worktree needed.
