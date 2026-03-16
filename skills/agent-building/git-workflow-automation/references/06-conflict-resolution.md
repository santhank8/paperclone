# Conflict Resolution in Automated Workflows

## Detection

In an automated loop, check exit codes — don't assume success.

```bash
# Rebase — exits non-zero if conflict
git rebase origin/main
REBASE_EXIT=$?

if [ $REBASE_EXIT -ne 0 ]; then
  echo "CONFLICT: rebase failed, intervention required"
  git rebase --abort
  # escalate (see below)
fi
```

```bash
# Merge — same pattern
git merge origin/main
MERGE_EXIT=$?
```

## The Stash-Rebase Pattern

Preferred for bringing a feature branch up to date with main before creating a PR:

```bash
# 1. Stash any uncommitted work
git stash push -m "pre-rebase stash $(date)"

# 2. Fetch latest main
git fetch origin main

# 3. Rebase onto main
git rebase origin/main

# 4. If successful, restore stash
if [ $? -eq 0 ]; then
  git stash pop
  echo "Rebase successful"
else
  # Conflict — abort and escalate
  git rebase --abort
  git stash pop
  echo "CONFLICT: manual resolution required"
  exit 1
fi
```

## Auto-Resolve vs. Escalate Decision Tree

```
Conflict detected
    │
    ├── Is the conflict in a generated/auto-updated file?
    │   (lock files, build artifacts, version files)
    │   └── YES → Auto-resolve: take theirs (origin/main version)
    │           git checkout --theirs path/to/file
    │           git add path/to/file
    │
    ├── Are both sides trivially non-overlapping?
    │   (e.g., two features adding different functions to same file)
    │   └── YES → Claude can resolve — provide both sides as context
    │
    └── Is it semantic/logic conflict?
        (same function modified differently on both sides)
        └── YES → ESCALATE — human judgment required
```

## Auto-Resolving Lock Files and Generated Files

```bash
# Accept the incoming (remote) version for auto-generated files
git checkout --theirs package-lock.json
git add package-lock.json

git checkout --theirs yarn.lock
git add yarn.lock

git checkout --theirs bun.lockb
git add bun.lockb

# Then continue rebase
git rebase --continue
```

## Giving Claude Enough Context to Resolve

When escalating to Claude for resolution, provide:

```bash
# Show the conflict markers in context
git diff --cc HEAD

# Show what changed on both sides
git log --oneline HEAD..MERGE_HEAD   # incoming changes
git log --oneline MERGE_HEAD..HEAD   # local changes

# Show the full conflict file
cat conflicted-file.ts
```

The conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) give Claude the exact splice points. The log gives it the semantic context for why each change exists.

## When to Abort and Report

Abort immediately if:
- More than 3 files have conflicts
- Conflicts are in core business logic
- You can't determine which version is "correct" without domain knowledge
- The conflict involves authentication, payments, or data integrity

```bash
# Abort and leave branch in pre-conflict state
git rebase --abort    # or git merge --abort

# Report with context
echo "BLOCKED: conflict resolution required in [files]. Branch is in pre-conflict state. No data was corrupted."
```

## Preventing Conflicts: Rebase Frequently

The best conflict resolution is conflict prevention. Short-lived feature branches that rebase against main frequently have far fewer and smaller conflicts.

```bash
# Add to your daily workflow or as a PostToolUse hook trigger
git fetch origin && git rebase origin/main
```

Branches that diverge for weeks generate conflicts that take hours. Branches that rebase daily generate conflicts that take minutes.

## Commit Message After Conflict Resolution

```bash
git commit -m "chore: resolve merge conflict with main

- Kept incoming auth token refresh logic (main) over local version
- Local feature additions preserved alongside main changes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## See Also

- [07-full-loop.md](07-full-loop.md) — where conflict handling fits in the full automation loop
- [02-worktrees.md](02-worktrees.md) — worktree isolation prevents the most common conflicts
