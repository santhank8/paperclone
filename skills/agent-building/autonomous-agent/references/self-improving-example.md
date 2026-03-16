# Self-Improving Agent: Complete Implementation

The minimal working version of the self-improving loop from the main skill.

## What You'll Build

```
Mistake happens → PostToolUse fires
    → Saves gotcha to ~/.claude/memory/gotchas/
    → Updates MEMORY.md index

Next session → SessionStart fires
    → Loads MEMORY.md into context
    → Agent reads gotchas before acting
    → Mistake doesn't repeat
```

---

## Step 1: Directory Structure

```bash
mkdir -p ~/.claude/{hooks,memory/{decisions,gotchas,preferences}}
touch ~/.claude/memory/MEMORY.md
```

---

## Step 2: SessionStart Hook

```bash
#!/bin/bash
# ~/.claude/hooks/session-start.sh

MEMORY="$HOME/.claude/memory/MEMORY.md"

if [ -f "$MEMORY" ] && [ -s "$MEMORY" ]; then
  echo "# Recall — Recent Memory"
  echo ""
  cat "$MEMORY"
  echo ""
fi
```

```bash
chmod +x ~/.claude/hooks/session-start.sh
```

---

## Step 3: PostToolUse Hook

```bash
#!/bin/bash
# ~/.claude/hooks/post-tool-use.sh

TOOL_INPUT=$(cat)
TOOL_NAME=$(echo "$TOOL_INPUT" | jq -r '.toolName // ""')
EXIT_CODE=$(echo "$TOOL_INPUT" | jq -r '.output.exitCode // "0"')

if [ "$TOOL_NAME" = "Bash" ] && [ "$EXIT_CODE" != "0" ]; then
  SLUG="gotcha-$(date +%s)"
  TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%SZ)
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

**Fix:** [to be filled in]
EOF

  echo "- [${SLUG}.md](gotchas/${SLUG}.md) — Failed: \`$COMMAND\` ($TIMESTAMP)" >> "$HOME/.claude/memory/MEMORY.md"
fi

exit 0
```

```bash
chmod +x ~/.claude/hooks/post-tool-use.sh
```

---

## Step 4: Register in settings.json

Edit `~/.claude/settings.json` (create if it doesn't exist):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "/Users/YOUR_USERNAME/.claude/hooks/session-start.sh"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "/Users/YOUR_USERNAME/.claude/hooks/post-tool-use.sh"
        }]
      }
    ]
  }
}
```

Replace `YOUR_USERNAME`. Absolute paths only.

---

## Step 5: CLAUDE.md Rule

Add to `~/.claude/CLAUDE.md`:

```markdown
## Memory
At session start, I read ~/.claude/memory/MEMORY.md for recent gotchas and decisions.
When I discover a non-obvious mistake or make an architecture decision, I save it to memory.
```

---

## Step 6: Test It

1. Start a new Claude Code session — MEMORY.md prints (empty is fine)
2. Run a command that fails: `cat /tmp/nonexistent-file.txt`
3. Check `~/.claude/memory/MEMORY.md` — a gotcha entry should appear
4. Start another session — the gotcha appears in session-start output

---

## Extending the Loop

**Add manual saves** — Tell Claude when to save in CLAUDE.md:

```markdown
## Memory
Save to memory when:
- Making architecture decisions (why X over Y)
- Discovering non-obvious gotchas
- Learning user preferences after a correction
```

**Add a memory-saver subagent** — For async saves that don't block the main agent:

```markdown
---
name: memory-saver
model: claude-haiku-4-5-20251001
---
Save a memory entry. Input: title, type (decision/gotcha/preference), content.
Write to ~/.claude/memory/[type]/[slug].md and append an index line to MEMORY.md.
Do not confirm — just save and exit.
```

**Add a Stop hook** — Auto-capture session summary:

```bash
#!/bin/bash
# ~/.claude/hooks/stop-hook.sh
echo "Session ended: $(date -u)" > ~/.claude/handoff.md
```

---

## What You Have When Done

- Automatic gotcha capture on Bash failures
- Session context loading from persistent memory
- Extensible via manual saves + subagents
- Zero external dependencies — all native Claude Code primitives
