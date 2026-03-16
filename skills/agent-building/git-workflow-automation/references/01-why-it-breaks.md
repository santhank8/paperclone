# Why Git + Multi-Agent Breaks

## The Exact Error

```
fatal: Unable to lock ref 'refs/heads/feat/my-feature': reference already exists
error: cannot lock ref 'refs/heads/feat/my-feature': is at abc123 but expected def456
```

Or the variant:
```
Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again.
```

## What's Happening

Two Claude Code agents running in the **same working directory** share one `.git` directory. When both try to:
- Read/write the same ref (`HEAD`, branch tip)
- Stage files via the index (`.git/index`)
- Run git operations concurrently

...git's lock mechanism kicks in. The second agent finds the lock file already held by the first and fails.

```
Single repo, shared working tree:
  /my-project/
    .git/           ← Agent A holds index.lock
    src/            ← Agent A writing here
                    ← Agent B also writing here → COLLISION
```

## Why Retrying Doesn't Help

The root cause is **shared state**, not timing. Retrying the same operation from the same directory just recreates the collision. You need to eliminate the sharing, not wait it out.

## The Fix: Git Worktrees

Git worktrees give each agent its own working directory with its own `HEAD`, its own index, and its own branch — but **sharing the same `.git/objects`** (so no repo duplication).

```
/my-project/
  .git/             ← shared object store, each worktree has separate HEAD
  src/              ← Agent A's working tree (main)

/tmp/worktree-b/
  .git → symlink    ← Agent B's private HEAD, index, branch
  src/              ← Agent B working here, zero contention
```

Agent A and Agent B never touch each other's state. The lock error becomes impossible.

## Claude Code's Built-In Support

When you use `isolation: "worktree"` in an Agent tool call, Claude Code automatically creates a temporary git worktree for that agent:

```typescript
Agent({
  isolation: "worktree",
  prompt: "Implement the authentication feature"
})
```

This is the mechanism under the hood. Understanding it helps you debug when things go wrong and set it up manually for complex workflows.

## Common Scenarios That Trigger This

| Scenario | Why it breaks |
|---|---|
| Two agents running parallel feature work | Same `.git/index` lock contention |
| Agent + human developer both coding | Index/ref collision |
| Agent creating + switching branches rapidly | Ref lock on branch tip |
| Multiple agents on the same file | Merge conflict + index lock compound |

## See Also

- [02-worktrees.md](02-worktrees.md) — how to set up worktrees
- [07-full-loop.md](07-full-loop.md) — complete workflow that prevents this
