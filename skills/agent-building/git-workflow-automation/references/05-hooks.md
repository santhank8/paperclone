# Hook-Based Git Automation

Three hooks cover the full session lifecycle: validate before starting, checkpoint during work, save on exit.

## Hook Configuration

All hooks live in `.claude/settings.json` (project-level) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "Stop": [...]
  }
}
```

Each hook entry:
```json
{
  "matcher": "ToolName",
  "hooks": [{
    "type": "command",
    "command": "your-bash-command"
  }]
}
```

## Hook 1: PreToolUse — Validate Branch Before Editing

**Purpose:** Prevent Claude Code from making changes directly on `main` or `master`.

```json
{
  "PreToolUse": [{
    "matcher": "Edit|Write|MultiEdit",
    "hooks": [{
      "type": "command",
      "command": "BRANCH=$(git branch --show-current 2>/dev/null); if [ \"$BRANCH\" = 'main' ] || [ \"$BRANCH\" = 'master' ]; then echo 'ERROR: On protected branch. Create a feature branch first.' >&2; exit 1; fi"
    }]
  }]
}
```

**What it does:** Before any Edit/Write/MultiEdit tool call, checks the current branch. If on `main` or `master`, exits with code 1 (blocks the tool call) and prints a clear error.

**Exit codes:**
- `0` → proceed with tool call
- `1` → block tool call, show error to Claude

## Hook 2: PostToolUse — Auto-Stage After Significant Writes

**Purpose:** Stage changed files automatically after file writes so `git status` stays clean and commits are easy.

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit|MultiEdit",
    "hooks": [{
      "type": "command",
      "command": "git add -A 2>/dev/null || true"
    }]
  }]
}
```

**What it does:** After every Write/Edit/MultiEdit, stages all changes. This means Claude can run `git commit -m "..."` without needing a separate `git add` step.

**Note:** `|| true` prevents the hook from failing if git isn't available or there's nothing to stage.

## Hook 3: Stop — WIP Commit Before Session Ends

**Purpose:** Guarantee in-progress work is committed before a Claude Code session ends, preventing context loss.

```json
{
  "Stop": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "git diff --quiet && git diff --staged --quiet || (git add -A && git commit -m 'wip: checkpoint [auto-stop]' --no-verify)"
    }]
  }]
}
```

**What it does:**
1. Checks for any uncommitted changes (unstaged or staged)
2. If changes exist: stages everything and commits with a WIP message
3. If clean: does nothing (`git diff --quiet` succeeds → no commit)

**The `--no-verify` flag:** Skips pre-commit hooks (like lint/format checks) on WIP commits. These aren't production commits — speed matters over quality gates.

## All Three Together

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "BRANCH=$(git branch --show-current 2>/dev/null); if [ \"$BRANCH\" = 'main' ] || [ \"$BRANCH\" = 'master' ]; then echo 'ERROR: On protected branch. Create a feature branch first.' >&2; exit 1; fi"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "git add -A 2>/dev/null || true"
      }]
    }],
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

## Advanced: Session-Tagged WIP Commits

Add the session timestamp to WIP commit messages for easy identification:

```json
{
  "Stop": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "git diff --quiet && git diff --staged --quiet || (git add -A && git commit -m \"wip: checkpoint $(date '+%Y-%m-%d %H:%M') [auto-stop]\" --no-verify)"
    }]
  }]
}
```

## Advanced: Push on Stop

For remote backup, push the WIP commit automatically:

```json
{
  "Stop": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "BRANCH=$(git branch --show-current); git diff --quiet && git diff --staged --quiet || (git add -A && git commit -m 'wip: checkpoint [auto-stop]' --no-verify && git push origin $BRANCH 2>/dev/null || true)"
    }]
  }]
}
```

## Gotchas

| Problem | Cause | Fix |
|---|---|---|
| PreToolUse blocks all edits on main | Correct behavior | Create feature branch before starting |
| WIP commit appears in PR | Stop hook fired on main branch | PreToolUse prevents this; if you bypassed it, squash the commit |
| `git add -A` stages unintended files | `.gitignore` not catching build artifacts | Add patterns to `.gitignore` |
| Hook command too long for JSON | JSON string length limit | Extract to a shell script and call `bash .claude/scripts/hook.sh` |
