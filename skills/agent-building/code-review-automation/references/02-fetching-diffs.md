# Fetching Diffs for Review

## Three Diff Sources

### 1. Open PR by Number (most common)
```bash
gh pr diff 47
gh pr diff 47 --name-only   # just the changed file list first
```

Requires: `gh` CLI authenticated, run from inside the repo.

### 2. Local Branch vs Main
```bash
git diff main...HEAD          # all changes since branching from main
git diff origin/main...HEAD   # same, against remote main
git diff main...HEAD -- src/  # scope to a directory
```

Use this before opening a PR or when you want to review before pushing.

### 3. Last Commit Only
```bash
git diff HEAD~1               # compare to previous commit
git diff HEAD~3               # last 3 commits
git diff abc123..def456       # specific commit range
```

Use this for incremental reviews during development.

## Exclusion Patterns

Don't waste reviewer context on generated/vendor files. Filter them out before passing to agents:

```bash
# Get diff and strip noise
gh pr diff 47 | grep -v '^diff --git.*\(package-lock\|yarn\.lock\|pnpm-lock\|\.min\.js\|\.min\.css\|dist/\|build/\|vendor/\|\.generated\.\)'
```

### Files to Always Exclude
```
*.lock                  # package-lock.json, yarn.lock, pnpm-lock.yaml
*.min.js, *.min.css     # minified assets
dist/, build/           # compiled output
vendor/                 # vendored dependencies
*generated*             # any generated files (graphql types, proto outputs)
__snapshots__/          # test snapshots (visual noise, rarely meaningful)
*.svg (large)           # SVG files if > 1KB (usually generated)
```

### Files to Review Even If Large
```
*.ts, *.tsx, *.js, *.jsx    # all source
*.py, *.go, *.swift, *.rs   # all source
*.sql                        # migrations — critical for security review
*.json (config)              # auth configs, permissions
.env.example                 # secrets checklist
```

## Scoping by Directory

For large PRs, scope the diff to focus on the highest-risk areas:

```bash
# Only review the auth and API directories
git diff main...HEAD -- src/auth/ src/api/

# Exclude tests, focus on source
git diff main...HEAD -- '*.ts' ':!*.test.ts' ':!*.spec.ts'

# Only new files (highest risk — no reviewer history)
git diff main...HEAD --diff-filter=A
```

## Handling Large Diffs

If the diff exceeds ~8K lines, the Agent tool context will struggle. Break it up:

```bash
# Get list of changed files
gh pr diff 47 --name-only

# Review by file group — highest risk files first
gh pr diff 47 -- src/auth/ src/middleware/   # auth first
gh pr diff 47 -- src/api/ src/services/      # then API layer
gh pr diff 47 -- src/components/             # then UI (lowest risk)
```

Rule of thumb: if `gh pr diff 47 | wc -l` returns > 5000, split into groups.

## Pipe Pattern (Clean Integration)

```bash
# Full pipeline: fetch → filter → review
gh pr diff 47 \
  | grep -v 'package-lock\|yarn.lock\|\.min\.' \
  > /tmp/review-diff.txt

# Then pass /tmp/review-diff.txt content to your review agents
wc -l /tmp/review-diff.txt  # verify size before sending
```
