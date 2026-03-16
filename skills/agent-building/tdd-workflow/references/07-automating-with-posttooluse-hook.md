# PostToolUse Hook: Automating the Loop

## What It Does

A PostToolUse hook fires after every Claude Code tool call that matches a pattern. Wired to Edit/Write on source files, it auto-runs your test suite after every change.

Result: you get immediate feedback on every edit without manually asking Claude to "run the tests again."

## Basic Hook Setup

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun test 2>&1 | tail -20"
          }
        ]
      }
    ]
  }
}
```

This runs `bun test` after every Edit or Write call and shows the last 20 lines (pass/fail summary).

**For pytest:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python -m pytest --tb=short 2>&1 | tail -20"
          }
        ]
      }
    ]
  }
}
```

## Path-Filtered Hook (Recommended)

Running the full test suite on every edit is too slow for large projects. Filter to only run when editing source files:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo '${{CLAUDE_TOOL_INPUT}}' | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))\"); if echo \"$FILE\" | grep -qE '\\.(ts|js|py)$' && ! echo \"$FILE\" | grep -qE '\\.(test|spec)\\.(ts|js|py)$'; then bun test 2>&1 | tail -20; fi"
          }
        ]
      }
    ]
  }
}
```

This runs tests only when editing `.ts`/`.js`/`.py` files that are NOT test files themselves. Editing a test file doesn't re-run — you're about to run it explicitly anyway.

## Swift/XCTest Hook

XCTest builds take longer. Run only on Swift source edits, not test files:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo '${{CLAUDE_TOOL_INPUT}}' | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))\"); if echo \"$FILE\" | grep -qE '\\.swift$' && ! echo \"$FILE\" | grep -qE 'Tests\\.swift$'; then xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,OS=26.2,name=iPhone 17 Pro' 2>&1 | grep -E 'PASSED|FAILED|error:' | tail -10; fi"
          }
        ]
      }
    ]
  }
}
```

Replace `MyApp` with your scheme name.

## Project-Scoped vs. User-Scoped

The hook above is user-scoped (`~/.claude/settings.json`) — fires in all projects. For a project-specific test command, use `.claude/settings.json` in the project root:

```json
// .claude/settings.json (project root)
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "bun test --project=core 2>&1 | tail -20"
          }
        ]
      }
    ]
  }
}
```

## Disabling the Hook Temporarily

When you're doing a large refactor and don't want test output flooding every step, comment out the hook entry in settings.json. Re-enable before committing.

Alternatively, run tests explicitly at key checkpoints rather than after every edit:

```bash
# Run only the test file you're working on
bun test src/format.test.ts

# Run full suite when ready to commit
bun test
```

## Verifying the Hook Fires

Make a small edit to a source file. In the next tool response, you should see the test output appended. If you don't see it, check:

1. `~/.claude/settings.json` is valid JSON (parse it: `cat ~/.claude/settings.json | python3 -m json.tool`)
2. The file path matched your Edit/Write pattern
3. The test command runs successfully from the project directory
