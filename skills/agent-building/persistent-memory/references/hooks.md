# Hook Implementations

Complete hook code for the persistent memory system. All paths must be absolute.

---

## SessionStart Hook

Loads MEMORY.md at session open, before the first user message.

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "cat ~/.claude/memory/MEMORY.md 2>/dev/null && echo '---MEMORY-LOADED---' || echo 'No memory index at ~/.claude/memory/MEMORY.md'"
      }]
    }]
  }
}
```

**Why it works:** Hook output becomes a `system` reminder injected before the model processes your first message. The model reads the index and knows what memory files to fetch before acting.

**Project-scoped variant** (memory lives in the repo):

```json
{
  "type": "command",
  "command": "cat .claude/memory/MEMORY.md 2>/dev/null || echo 'No project memory found'"
}
```

**Loading both global + project:**

```json
{
  "type": "command",
  "command": "cat ~/.claude/memory/MEMORY.md 2>/dev/null; cat .claude/memory/MEMORY.md 2>/dev/null; echo '---MEMORY-LOADED---'"
}
```

---

## Stop Hook

Prompts memory review before exit.

```json
"Stop": [{
  "matcher": "",
  "hooks": [{
    "type": "command",
    "command": "echo 'SESSION ENDING: Did you make decisions, hit gotchas, or learn anything worth saving? If yes, save to ~/.claude/memory/ before the session closes.'"
  }]
}]
```

**Blocking variant** (exit code 2 prevents exit until user approves):

```bash
#!/bin/bash
# ~/.claude/hooks/stop-review.sh
# Must be executable: chmod +x ~/.claude/hooks/stop-review.sh

echo "SESSION ENDING: Review memory before shutdown."
echo "Save any decisions, gotchas, or breakthroughs with: Write ~/.claude/memory/[topic].md"
echo "Update MEMORY.md index with the new link."
echo "When done, approve shutdown."
exit 2  # Blocks exit — user must approve
```

Hook config (use absolute path):

```json
{
  "type": "command",
  "command": "/Users/you/.claude/hooks/stop-review.sh"
}
```

---

## PostToolUse Hook (Continuous Capture)

Fires after key tool calls. Prompts capture at the moment of discovery.

```json
"PostToolUse": [{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "echo 'CAPTURE SIGNAL: Did this change reveal a decision or gotcha worth saving? Save now — not at end of session.'"
  }]
}]
```

**Filtered to high-signal operations:**

```json
"PostToolUse": [{
  "matcher": "Edit",
  "hooks": [{
    "type": "command",
    "command": "echo 'File edited. Would you be annoyed re-deriving the why next session? Save it if so.'"
  }]
}]
```

---

## Full settings.json Template

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "cat ~/.claude/memory/MEMORY.md 2>/dev/null && echo '---MEMORY-LOADED---' || echo 'Memory index not found'"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "echo 'SESSION ENDING: Save any decisions, gotchas, or breakthroughs before exiting.'"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "echo 'Worth saving to memory? Capture decisions before you forget.'"
      }]
    }]
  }
}
```

---

## Hook Gotchas

| Gotcha | Fix |
|--------|-----|
| Hook silently fails | Use absolute paths — relative paths don't resolve from hook context |
| Stop hook blocks unexpectedly | Only use `exit 2` for fully autonomous agents. For interactive sessions, use the echo prompt instead. |
| PostToolUse fires too often | Tighten the matcher: `"Edit"` instead of `"Edit\|Write\|Bash"` |
| SessionStart output not visible | Output appears as system reminder in the conversation, not a user message |

---

## Combining with Recall MCP (Optional Upgrade)

If recall MCP is configured, you can augment the SessionStart hook:

```json
{
  "type": "command",
  "command": "cat ~/.claude/memory/MEMORY.md 2>/dev/null; echo '---MEMORY-LOADED---'"
}
```

Use `save_memory` recall tool for semantic search on top of the file system. Files remain your canonical source — recall adds search capability.
