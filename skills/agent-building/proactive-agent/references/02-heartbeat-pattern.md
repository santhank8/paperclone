# Heartbeat Pattern

## The Core Pattern

```
/loop 60s Silently check [source] for [condition].
ONLY speak if [change detected]. If nothing changed, output NOTHING — completely silent.
```

This is the silence contract. It's not optional.

A heartbeat that narrates every quiet check is worse than no heartbeat — it floods the conversation, burns context, and trains the user to ignore it. The only time a heartbeat should output anything is when the world changed.

---

## /loop Invocation

```
/loop <interval> <prompt>
```

| Parameter | Examples |
|---|---|
| `interval` | `30s`, `60s`, `5m`, `1h` |
| `prompt` | Any prompt — usually with explicit silence instructions |

The loop runs until you stop it (`Ctrl+C` or close the session).

---

## The Silence Contract — Enforcing It

The silence contract must be explicit in the prompt. Claude will narrate by default; you override this with a direct instruction.

**Weak (will narrate):**
```
/loop 60s Check GitHub for new PRs and report what you find.
```

**Strong (enforces silence):**
```
/loop 60s Check GitHub for new PRs opened in the last 60 seconds using:
gh pr list --repo owner/repo --json number,title,createdAt --limit 20

Compare against last known PR numbers in .claude/last-prs.json.
If NEW PRs found: list them with number + title.
If NOTHING NEW: output absolutely nothing — no "all clear", no "checked at", no status line.
Update .claude/last-prs.json with current PR numbers regardless.
```

The key phrase: **"output absolutely nothing"**. "No status updates" is ambiguous. "Absolutely nothing" is not.

---

## State Tracking in Heartbeats

Heartbeats need to know what "changed" means. That requires a baseline.

Pattern: write a state file on each check, compare against it on the next.

```
/loop 60s
Read .claude/heartbeat-state.json (or initialize to {}).

Check [source] for current state.

Compare current state against stored state:
- If different: alert with what changed. Write new state to .claude/heartbeat-state.json.
- If same: write nothing, output nothing.
```

### Example: Paperclip CEO Heartbeat
```
/loop 60s Silently check Paperclip at http://localhost:3101/api/companies/[ID]/issues
for status changes. ONLY speak if an issue has changed to done/completed/failed since last check.
If nothing changed, output NOTHING — no "clear", no "quiet", no status update. Completely silent.
When something DID change: pull the comments and give Doug a brief summary.
```

This runs silently for hours. When an agent completes work, the summary appears with no noise.

---

## Rate Management

| Use Case | Recommended Interval | Why |
|---|---|---|
| Deploy status | 2-5 minutes | Fast feedback, reasonable API cost |
| PR/issue monitor | 5-15 minutes | Changes don't happen sub-minute |
| Daily digest | Use CronCreate instead | Single execution at fixed time |
| Real-time alerts | 30-60 seconds | Lower than 30s rarely justified |

**Never use sub-30s intervals** unless you have a specific, justified need. At 10s intervals over 8 hours, you're making 2,880 API calls.

---

## Debugging Heartbeats

**Symptom: Heartbeat outputs on every check even when nothing changed**
- Cause: State tracking broken — comparing against fresh baseline each time
- Fix: Verify state file is being written AND read between checks

**Symptom: Heartbeat misses changes**
- Cause: State comparison logic is too strict (comparing full objects vs key fields)
- Fix: Compare only the fields that represent "change" (IDs, statuses, timestamps)

**Symptom: Heartbeat runs, nothing happens ever**
- Cause: Silence contract too aggressive — suppressing output even on changes
- Fix: Test the change-detection branch manually before deploying the loop

**Debugging approach:**
1. Run one manual check (without /loop) and inspect the output
2. Verify the state file exists and contains expected data
3. Simulate a change and confirm the alert branch fires
4. Then enable the loop

---

## Heartbeat vs CronCreate Decision

| Heartbeat (`/loop`) | CronCreate |
|---|---|
| Needs active Claude Code session | Fires even when no session is open |
| Easy to stop (Ctrl+C) | Persists until explicitly deleted |
| Good for monitoring while you work | Good for scheduled background jobs |
| Interval in seconds/minutes | Cron expression (more precise scheduling) |
| Context accumulates over time | Fresh context per invocation |

Use heartbeat when you're actively working and want ambient monitoring.
Use CronCreate when you need the job to run whether or not you're present.
