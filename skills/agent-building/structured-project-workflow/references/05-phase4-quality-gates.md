# Phase 4: Quality Gates

## What This Phase Does

Enforces that "done" means done — not "Claude thinks it's done." Quality gates are automated checks that run before a step can be marked complete.

Gates run as hooks. They catch issues at edit time, not review time.

## Hook Types for Quality

### PostToolUse — Auto-Verify After Edit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd $PROJECT_ROOT && bun run typecheck 2>&1 | tail -5"
          }
        ]
      }
    ]
  }
}
```

Hooks go in `~/.claude/settings.json` (user-level) or `.claude/settings.json` (project-level, repo-scoped).

## What "Done" Means for a Step

Before marking any TASK.md step `done`, verify:

| Gate | Check | How |
|---|---|---|
| Build | No compile errors | `bun run build` or `xcodebuild` |
| Types | No type errors | `bun run typecheck` |
| Tests | Related tests pass | `bun test [files affected]` |
| Acceptance | Each criterion checked | Read TASK.md, tick each checkbox |
| Invariants | No CLAUDE.md violations | Read CLAUDE.md, compare diff |

## Step-Level Review Pattern

Claude proposes "Step N done." Before you approve:

```
Review checklist:
[ ] Open the diff. Does it match the step scope? (No extra changes)
[ ] Run bun test. Do tests pass?
[ ] Read TASK.md step acceptance criteria. Are all checkboxes met?
[ ] Read CLAUDE.md invariants. Does the diff violate any?
[ ] Is there anything in the diff you'd want to revert tomorrow?
```

If yes to any concern: reject, fix, re-check.

## Project-Level Anti-Pattern Hook

Enforce project-specific rules automatically. Example: surface invariants before every edit:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo '--- CLAUDE.md Invariants ---' && grep -A20 '### Invariants' CLAUDE.md 2>/dev/null | head -20 || echo 'No CLAUDE.md found'"
          }
        ]
      }
    ]
  }
}
```

This surfaces invariants before every edit. Claude reads them. Violations drop.

## Checklist: Quality Gates Installed

- [ ] PostToolUse hook runs build or typecheck on Edit
- [ ] Acceptance criteria in TASK.md are testable (not subjective)
- [ ] Review checklist used before each step marked done
- [ ] CLAUDE.md invariants reviewed on each step approval
