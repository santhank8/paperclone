# State Management Across Sessions

## Why State Management Matters

CronCreate fires on a schedule. Between invocations, there's no persistent memory. Without a state file:

- The cron reprocesses items it already handled
- "New since last check" means "new since the beginning of time"
- Partial runs leave no record of how far they got

State management is the mechanism that makes scheduled agents accumulate work rather than repeat it.

---

## The Three Files

| File | Purpose |
|---|---|
| `.claude/agent-state.json` | General agent state (lastCheck timestamp, config) |
| `.claude/scheduled_tasks.lock` | Work queue — tasks discovered but not yet processed |
| `.claude/[monitor]-cursor.json` | Domain-specific cursor (last seen PR #, last commit SHA, etc.) |

Keep state files in `.claude/` so they're ignored by git but persist across sessions.

---

## Stop Hook — Save Before Exit

The `Stop` hook fires when Claude Code closes or the session ends.

```json
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "command": "node -e \"const fs = require('fs'); const state = {lastCheck: Date.now(), timestamp: new Date().toISOString()}; fs.mkdirSync('.claude', {recursive: true}); fs.writeFileSync('.claude/agent-state.json', JSON.stringify(state, null, 2));\""
    }]
  }
}
```

For more complex state, use a dedicated script:

```js
// .claude/save-state.js
const fs = require('fs');

const state = {
  lastCheck: Date.now(),
  timestamp: new Date().toISOString(),
  queue: JSON.parse(fs.readFileSync('.claude/task-queue.json', 'utf8') || '[]'),
  version: 1
};

fs.mkdirSync('.claude', { recursive: true });
fs.writeFileSync('.claude/agent-state.json', JSON.stringify(state, null, 2));
process.stdout.write(`State saved: ${state.queue.length} queued items\n`);
```

```json
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{ "command": "node .claude/save-state.js" }]
  }
}
```

---

## SessionStart Hook — Restore and Drain Queue

The `SessionStart` hook fires at the beginning of each session. Use it to:
1. Reload state from the last save
2. Display what work is queued
3. Signal the agent to process queued items

```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [{
      "command": "node -e \"const fs = require('fs'); try { const s = JSON.parse(fs.readFileSync('.claude/agent-state.json')); const age = Math.round((Date.now()-s.lastCheck)/60000); console.log('Agent state: last check ' + age + 'm ago, ' + (s.queue||[]).length + ' items queued'); } catch(e) { console.log('No agent state found — fresh start'); }\""
    }]
  }
}
```

The hook output appears in Claude Code's context, so the agent can read it and act on queued work automatically.

---

## The scheduled_tasks.lock Pattern

The lock file is a simple work queue. Items accumulate in it; scheduled tasks drain it.

```json
// .claude/scheduled_tasks.lock
{
  "version": 1,
  "updatedAt": "2026-03-15T09:00:00Z",
  "queue": [
    { "id": "pr-142", "type": "pr-review", "addedAt": "2026-03-15T08:30:00Z" },
    { "id": "issue-89", "type": "issue-triage", "addedAt": "2026-03-15T08:45:00Z" }
  ],
  "processed": [
    { "id": "pr-140", "type": "pr-review", "processedAt": "2026-03-15T08:00:00Z" }
  ]
}
```

**Discovery step** (runs on cron):
```
Read .claude/scheduled_tasks.lock
Fetch current items from [source]
For each item NOT in processed[]:
  Add to queue[] with addedAt timestamp
Write updated lock file
```

**Processing step** (runs on session start or separate cron):
```
Read .claude/scheduled_tasks.lock
For each item in queue[]:
  Process it
  Move from queue[] to processed[]
  Write updated lock file after each item (crash-safe)
```

---

## Cursor-Based Tracking

For high-volume sources (commits, logs), use a cursor instead of a full list.

```json
// .claude/github-cursor.json
{
  "lastPRNumber": 142,
  "lastIssueNumber": 89,
  "lastCommitSHA": "a3f8b2c",
  "updatedAt": "2026-03-15T09:00:00Z"
}
```

Cron prompt:
```
Read .claude/github-cursor.json.
Fetch PRs with number > lastPRNumber.
If new PRs found: post summary, update lastPRNumber in cursor file.
If no new PRs: update updatedAt only, output nothing.
```

This is efficient — you only compare against the cursor value, not a growing list.

---

## Handling Partial Runs

Crons can be interrupted. Write state after each item, not after all items:

```
For each item in queue:
  1. Process item
  2. Mark as processed in lock file (write immediately)
  3. Continue to next item

# If interrupted after step 2, item is marked done — safe to skip on restart
# If interrupted between 1 and 2, item will be retried — make processing idempotent
```

Make processing idempotent: re-processing an already-processed item should have no side effects. The `processed[]` array handles deduplication.

---

## State File Schema Best Practices

```json
{
  "version": 1,          // Increment when schema changes
  "updatedAt": "ISO",    // Always include — helps debug stale state
  "lastCheck": 1710000000000,  // Unix ms — easy arithmetic
  "cursor": {},          // Domain-specific position tracking
  "queue": [],           // Pending work
  "config": {}           // Runtime config that changes
}
```

Keep state files human-readable (formatted JSON). You'll need to debug them.
