# Anti-Patterns and Rate Safety

## Anti-Pattern 1: Over-Polling

**Wrong:**
```
/loop 10s Check GitHub for new PRs every 10 seconds.
```

**What happens:** 360 API calls per hour, 2,880 per 8-hour day. GitHub rate limits at 5,000/hour authenticated — you'll hit it with multiple repos or monitors. More critically, you'll spend $50-200/day on Claude API calls for checks that find nothing 99% of the time.

**Right:**
```
CronCreate({
  name: "pr-monitor",
  cron: "*/15 9-18 * * 1-5",   // Every 15 min, business hours only
  prompt: "..."
})
```

Rate guidance by use case:
| Use Case | Max Frequency | Why |
|---|---|---|
| Deploy status | Every 2 min | Fast feedback justified — deploys are brief |
| PR/issue changes | Every 15 min | Sub-15min PR response isn't expected |
| Daily digest | Once daily (CronCreate) | Accumulate, don't spam |
| Dependency updates | Weekly | Packages don't change that fast |

---

## Anti-Pattern 2: Blocking the Main Loop

**Wrong:**
```
// In CLAUDE.md heartbeat:
/loop 10s Run bun test and output the full test results every 10 seconds.
```

**What happens:** The test suite takes 30 seconds. The loop fires before the previous run completes. Output floods the conversation. The main session becomes unusable.

**Right:**
Use background agents for long-running work, not heartbeats:
```
// In CLAUDE.md:
/loop 5m Silently check .claude/test-results.json for changes.
If tests changed: summarize failures.
If unchanged: output nothing.

// A separate PostToolUse hook writes test results to .claude/test-results.json
```

The heartbeat reads a file; a hook writes it. They never block each other.

---

## Anti-Pattern 3: Recursive Hook Triggers

**Wrong:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit",
      "command": "claude -p 'Check the file I just edited and fix any issues'"
    }]
  }
}
```

**What happens:** Claude edits a file → hook fires → Claude edits the same file → hook fires → infinite loop.

**Right:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit",
      "command": "node .claude/run-tests.js"   // Write result file, don't invoke Claude
    }]
  }
}
```

Hooks should trigger tools (test runners, linters, file writes). They should NOT trigger Claude invocations that trigger further edits.

---

## Anti-Pattern 4: Losing State on Crash

**Wrong:**
```
// Process entire queue, THEN write state file
For each item in queue:
  process(item)
Write state file
```

**What happens:** Crash after item 7 of 20. State file never written. All 20 items are reprocessed on the next run.

**Right:**
```
// Write state file after EACH item
For each item in queue:
  process(item)
  mark_processed(item)        // Write to state file immediately
  continue to next item
```

If you crash between processing and writing — you may reprocess item N+1 once. That's acceptable if processing is idempotent. The key: never lose multiple items of state at once.

---

## Anti-Pattern 5: Noisy Heartbeats

**Wrong:**
```
/loop 60s Check Paperclip for issue updates and tell me what you found.
```

**Sample output every 60 seconds:**
```
Checked Paperclip at 09:00 — no changes detected.
Checked Paperclip at 09:01 — no changes detected.
Checked Paperclip at 09:02 — no changes detected.
...
```

**What happens:** 60 lines per hour of noise. After one day, the conversation is thousands of lines. The real alerts get buried. The user learns to ignore everything from the heartbeat.

**Right:**
```
/loop 60s Silently check Paperclip for status changes.
ONLY speak if an issue changed to done/completed/failed.
If nothing changed: output NOTHING — no "checking", no "clear", no timestamp.
```

The user sees output from the heartbeat exactly twice a day — when issues actually complete.

---

## Anti-Pattern 6: Session-Dependent Scheduling

**Wrong:**
```
// In CLAUDE.md:
When I first open a session, set up monitoring using /loop.
```

**What happens:** User opens a session without mentioning monitoring. Nothing runs. User closes session. Nothing runs.

**Right:**
```
// In CLAUDE.md:
On every session start:
/loop 60s [heartbeat prompt]

// Or better, use CronCreate for work that must happen regardless:
CronCreate({ name: "daily-check", cron: "0 9 * * *", ... })
```

For critical scheduled work, use CronCreate. It doesn't depend on a session being open.

---

## Rate Safety Checklist

Before deploying any proactive agent:

- [ ] What's the maximum calls-per-hour this agent can make?
- [ ] Is the poll interval justified by the latency requirement?
- [ ] Is the silence contract explicit in the prompt?
- [ ] Is state written after each item, not after all items?
- [ ] Are hooks writing to files (not invoking Claude)?
- [ ] Is the cron restricted to business hours if appropriate?
- [ ] Is there a CronDelete step in the teardown process?
