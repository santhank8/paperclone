# Session-End Summary — Stop Hook and Audit

## Purpose

The Stop hook fires when a Claude Code session ends (user closes session, `/exit`, or timeout). It runs a lightweight audit of the session and saves a 5-line summary to disk.

Without this, session context is lost. The agent starts fresh with zero data about what happened. The Stop hook is how violations cross session boundaries.

## settings.json Configuration

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/session-audit.js"
      }]
    }]
  }
}
```

## session-audit.js

```javascript
#!/usr/bin/env node
// ~/.claude/hooks/session-audit.js

const fs = require('fs');
const path = require('path');
const os = require('os');

const VIOLATIONS_LOG = path.join(os.homedir(), '.claude', 'violations.jsonl');
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const LESSONS_FILE = path.join(os.homedir(), '.claude', 'lessons-learned.md');

const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown';
const date = new Date().toISOString().split('T')[0];

// 1. Read this session's violations
const allViolations = fs.existsSync(VIOLATIONS_LOG)
  ? fs.readFileSync(VIOLATIONS_LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

const sessionViolations = allViolations.filter(v => v.sessionId === sessionId);

// 2. Group by type and count
const violationCounts = {};
sessionViolations.forEach(v => {
  violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
});

// 3. Build 5-line summary
const topViolations = Object.entries(violationCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([type, count]) => `  - ${type}: ${count}x`)
  .join('\n');

const summary = `## Session ${date}
- Violations: ${sessionViolations.length} total (${Object.keys(violationCounts).length} types)
${topViolations || '  - none'}
- Status: ${sessionViolations.length > 0 ? 'review lessons-learned.md' : 'clean session'}
`;

// 4. Save to sessions/
fs.mkdirSync(SESSIONS_DIR, { recursive: true });
fs.appendFileSync(path.join(SESSIONS_DIR, `${date}.md`), summary + '\n');

// 5. Auto-promote to lessons-learned.md if any type hit threshold
// (optional — requires reading all sessions to count cross-session frequency)
console.log(`Session audit saved: ${sessionViolations.length} violations logged`);
```

## Output Format

Saved to `~/.claude/sessions/YYYY-MM-DD.md`:

```markdown
## Session 2026-03-15
- Violations: 4 total (2 types)
  - bash_instead_of_glob: 3x
  - grep_not_grep_tool: 1x
- Status: review lessons-learned.md

## Session 2026-03-15 (second session)
- Violations: 0 total (0 types)
  - none
- Status: clean session
```

## The 5-Line Rule

Keep summaries to 5 lines maximum. The value is in pattern detection across sessions, not per-session detail. The per-session detail lives in `violations.jsonl` — reference that for specifics.

**What to include:** violation types + counts, overall status.
**What to exclude:** full commands, file paths, stack traces, decision details.

## SessionStart Hook: Loading Context

Pair the Stop hook with a SessionStart hook to load prior violations at session start:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "node ~/.claude/hooks/session-start.js"
      }]
    }]
  }
}
```

```javascript
// ~/.claude/hooks/session-start.js
// Prints recent violation summary to session context

const recentSessions = fs.readdirSync(SESSIONS_DIR)
  .sort().slice(-3)  // last 3 sessions
  .map(f => fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'))
  .join('\n');

console.log('# Recent Session Violations\n' + recentSessions);
// This output appears in the model's context window at session start
```

## Cross-Session Pattern Detection

After 5+ sessions, query the session files to find persistent patterns:

```bash
cat ~/.claude/sessions/*.md | grep -c "bash_instead_of_glob"
```

When any violation type appears in 2+ distinct session summaries → create or update the `lessons-learned.md` entry.

## What the Stop Hook Does NOT Do

- Does NOT auto-update CLAUDE.md — that's Phase 3 (manual, with keep/discard verification)
- Does NOT auto-create lessons entries — requires human threshold judgment
- Does NOT summarize decisions or context — use the handoff skill for that
