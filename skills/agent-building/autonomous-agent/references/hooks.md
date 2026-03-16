# Hooks Reference: Working Code Examples

## PreToolUse — Rule Enforcement

Block forbidden patterns before they execute.

**Example: Enforce bun over npm**

```bash
#!/bin/bash
# ~/.claude/hooks/pre-tool-use.sh
# Blocks npm commands in favor of bun

TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.input.command // ""')

if echo "$COMMAND" | grep -qE "^npm (install|run|test|build)"; then
  echo "BLOCK: Use bun instead of npm. Run: ${COMMAND/npm/bun}" >&2
  exit 1
fi

exit 0
```

**Register in `~/.claude/settings.json`:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "/Users/YOU/.claude/hooks/pre-tool-use.sh" }]
      }
    ]
  }
}
```

**Rules:**
- Exit 0 = allow. Exit non-zero = block with error.
- Write to stderr — Claude Code sees it as a message.
- Hook receives tool input as JSON on stdin.
- `PreToolUse` has `toolName` + `input` but no `output` (not run yet).

---

## PostToolUse — Learning Capture

Capture decisions and gotchas after key actions.

**Example: Auto-save Bash failures as gotchas**

```bash
#!/bin/bash
# ~/.claude/hooks/post-tool-use.sh

TOOL_INPUT=$(cat)
TOOL_NAME=$(echo "$TOOL_INPUT" | jq -r '.toolName // ""')
EXIT_CODE=$(echo "$TOOL_INPUT" | jq -r '.output.exitCode // "0"')

if [ "$TOOL_NAME" = "Bash" ] && [ "$EXIT_CODE" != "0" ]; then
  TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%SZ)
  SLUG="gotcha-$(date +%s)"
  COMMAND=$(echo "$TOOL_INPUT" | jq -r '.input.command // "unknown"')
  STDERR=$(echo "$TOOL_INPUT" | jq -r '.output.stderr // ""' | head -5)

  GOTCHA_FILE="$HOME/.claude/memory/gotchas/${SLUG}.md"
  cat > "$GOTCHA_FILE" << EOF
---
date: $TIMESTAMP
type: gotcha
---
# Failed: $COMMAND

**Error:**
\`\`\`
$STDERR
\`\`\`

**Fix:** [fill in or let Claude suggest]
EOF

  echo "- [${SLUG}.md](gotchas/${SLUG}.md) — Failed: \`$COMMAND\` ($TIMESTAMP)" >> "$HOME/.claude/memory/MEMORY.md"
fi

exit 0
```

**PostToolUse input format:**

```json
{
  "toolName": "Bash",
  "input": { "command": "npm install" },
  "output": {
    "exitCode": 1,
    "stdout": "",
    "stderr": "command not found: npm"
  }
}
```

---

## SessionStart — Context Loading

Print memory context so Claude Code sees it before the first user turn.

**Example: Load MEMORY.md index**

```bash
#!/bin/bash
# ~/.claude/hooks/session-start.sh

MEMORY="$HOME/.claude/memory/MEMORY.md"

if [ -f "$MEMORY" ] && [ -s "$MEMORY" ]; then
  echo "# Recall — Memory Index"
  echo ""
  cat "$MEMORY"
  echo ""
fi
```

**Key:** Hook stdout is injected into session context as a system message. Claude Code reads it before any user input.

**Register:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "/Users/YOU/.claude/hooks/session-start.sh" }]
      }
    ]
  }
}
```

---

## Stop — Session Close

Auto-save state on session end.

**Example: Write handoff file**

```bash
#!/bin/bash
# ~/.claude/hooks/stop-hook.sh

cat > "$HOME/.claude/handoff.md" << EOF
# Session Handoff
**Closed:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

Session ended. Check git log for recent changes.
EOF
```

---

## Full Hook Input Schema

```json
{
  "toolName": "string",
  "input": { /* tool-specific */ },
  "output": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": "..."
  }
}
```

- `PreToolUse`: `toolName` + `input` only (output not available)
- `PostToolUse`: `toolName` + `input` + `output`
- `SessionStart`, `Stop`: no input at all

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Relative path in `command` | Hook silently never runs | Use absolute path: `/Users/you/...` |
| Exit 1 from PostToolUse | Claude Code shows error | Only exit non-zero from PreToolUse to block |
| Missing `jq` | JSON parse fails | `brew install jq` |
| Matching too broadly | Every tool triggers the hook | Use `"matcher": "Bash"` to scope it |
