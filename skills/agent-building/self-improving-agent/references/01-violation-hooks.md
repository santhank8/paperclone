# Violation Hooks — PostToolUse Detection

## How It Works

A PostToolUse hook fires after every matching tool call. The hook script reads CLAUDE.md rules, inspects the tool call that just fired, and logs violations to a structured file.

## settings.json Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node ~/.claude/hooks/violation-detector.js"
        }]
      },
      {
        "matcher": ".*",
        "hooks": [{
          "type": "command",
          "command": "node ~/.claude/hooks/tool-audit.js"
        }]
      }
    ]
  }
}
```

The `.*` matcher catches all tools for the broader audit. The `Bash` matcher handles the most common violation pattern.

## violation-detector.js

```javascript
#!/usr/bin/env node
// ~/.claude/hooks/violation-detector.js
// Reads PostToolUse context from stdin, classifies violations, appends to log

const fs = require('fs');
const path = require('path');
const os = require('os');

const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const { tool_name, tool_input } = input;

const VIOLATION_LOG = path.join(os.homedir(), '.claude', 'violations.jsonl');

// Classification rules: check tool_input against known violation patterns
const violations = [];

if (tool_name === 'Bash') {
  const cmd = tool_input.command || '';

  if (/\bls\b/.test(cmd) && !/\bls -la\b/.test(cmd.replace(/ls -la/, ''))) {
    violations.push({ type: 'bash_instead_of_glob', detail: cmd });
  }
  if (/\bgrep\b/.test(cmd) || /\brg\b/.test(cmd)) {
    violations.push({ type: 'grep_not_grep_tool', detail: cmd });
  }
  if (/\bcat\b/.test(cmd) || /\bhead\b/.test(cmd) || /\btail\b/.test(cmd)) {
    violations.push({ type: 'cat_instead_of_read', detail: cmd });
  }
  if (/\bfind\s/.test(cmd)) {
    violations.push({ type: 'find_instead_of_glob', detail: cmd });
  }
}

if (violations.length === 0) process.exit(0);

const timestamp = new Date().toISOString();
const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown';

violations.forEach(v => {
  const entry = JSON.stringify({ ...v, timestamp, sessionId, tool: tool_name });
  fs.appendFileSync(VIOLATION_LOG, entry + '\n');
});
```

## Violation Types

| Type | Trigger Condition | Rule Violated |
|---|---|---|
| `bash_instead_of_glob` | `ls` or `find` in Bash command | Use Glob for file discovery |
| `grep_not_grep_tool` | `grep` or `rg` in Bash command | Use Grep tool for content search |
| `cat_instead_of_read` | `cat`, `head`, `tail` in Bash command | Use Read tool for file inspection |
| `find_instead_of_glob` | `find` in Bash command | Use Glob for file discovery |
| `skipped_lsp` | Grep used for `function\|class\|interface` patterns | Use LSP (goToDefinition, findReferences) |
| `any_type_used` | TypeScript content contains `: any` | No `any` types — use `unknown` with guards |

## Signal vs Noise Routing

Not every violation is actionable. Route before logging:

| Severity | Criteria | Action |
|---|---|---|
| **Signal** | Same violation type in 2+ distinct sessions | Add to lessons-learned.md |
| **Noise** | One-off, edge case, or intentional override | Log only (don't promote to lessons) |
| **Ignore** | Test files, commented code, intentional escape hatch | Skip entirely |

## Violation Log Format (.jsonl)

Each line is a JSON object:
```json
{"type":"bash_instead_of_glob","detail":"ls -la","timestamp":"2026-03-10T14:22:00Z","sessionId":"abc123","tool":"Bash"}
```

Query the log to find patterns:
```bash
# Count by violation type
cat ~/.claude/violations.jsonl | python3 -c "
import sys, json, collections
lines = [json.loads(l) for l in sys.stdin]
counts = collections.Counter(l['type'] for l in lines)
print(counts.most_common())
"
```

## Session Summary Hook (lightweight alternative)

Instead of per-call detection, count violations at session end:

```javascript
// ~/.claude/hooks/session-summary.js (Stop hook)
const violations = fs.readFileSync(VIOLATION_LOG, 'utf8')
  .split('\n').filter(Boolean)
  .map(l => JSON.parse(l))
  .filter(v => v.sessionId === currentSessionId);

const counts = {};
violations.forEach(v => counts[v.type] = (counts[v.type] || 0) + 1);
// → write to lessons-learned.md if any count >= 2
```
