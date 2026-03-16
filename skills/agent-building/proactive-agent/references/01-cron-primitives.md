# CronCreate Primitives

## The Three Tools

```
CronCreate({ name, cron, prompt, workingDirectory })
CronList()
CronDelete({ name })
```

CronCreate registers a scheduled task that Claude Code fires on the cron expression, even when no conversation is active.

---

## CronCreate Parameters

| Parameter | Required | Description |
|---|---|---|
| `name` | Yes | Unique identifier — use for CronDelete |
| `cron` | Yes | Standard 5-field cron expression |
| `prompt` | Yes | The instruction Claude executes when the schedule fires |
| `workingDirectory` | No | Directory context for the run |

---

## Cron Expression Cheatsheet

```
┌─── minute (0-59)
│  ┌── hour (0-23)
│  │  ┌─ day of month (1-31)
│  │  │  ┌ month (1-12)
│  │  │  │  ┌ day of week (0-6, Sun=0)
│  │  │  │  │
*  *  *  *  *
```

Common patterns:
```
0 9 * * *       → 9am every day
0 9 * * 1       → Monday 9am
0 */2 * * *     → Every 2 hours
0 8,17 * * 1-5  → 8am and 5pm weekdays
*/30 9-17 * * * → Every 30 min during business hours
0 0 * * 0       → Sunday midnight (weekly)
0 9 1 * *       → First of every month at 9am
```

---

## Use Case Patterns

### Daily Digest
```
CronCreate({
  name: "daily-github-digest",
  cron: "0 9 * * *",
  prompt: `Check GitHub for:
1. PRs opened or merged since yesterday
2. Issues created since yesterday
3. Any review requests assigned to me

Format as a brief digest. If nothing changed, output nothing.`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

### Weekly Retro
```
CronCreate({
  name: "weekly-retro",
  cron: "0 9 * * 1",
  prompt: `Run /retro for last week.
Post the output to .claude/weekly-retros/$(date +%Y-%m-%d).md`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

### Dependency Update Check
```
CronCreate({
  name: "dep-check",
  cron: "0 10 * * 1",
  prompt: `Run bun outdated. If any packages are more than one major version behind, create an issue in .claude/issues/deps-$(date +%Y-%m-%d).md listing them. If everything is current, output nothing.`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

### PR Staleness Monitor
```
CronCreate({
  name: "pr-stale-check",
  cron: "0 */4 * * *",
  prompt: `Run: gh pr list --repo owner/repo --json number,title,updatedAt,reviewDecision
Check for PRs not updated in 48+ hours. If any found, post a summary. If none, output nothing.`,
  workingDirectory: "/Users/me/projects/myapp"
})
```

---

## Managing Schedules

```
// See what's running
CronList()

// Cancel a schedule
CronDelete({ name: "daily-github-digest" })

// Replace a schedule (delete + recreate)
CronDelete({ name: "dep-check" })
CronCreate({ name: "dep-check", cron: "0 10 * * 2", prompt: "..." })
```

---

## Error Handling in Cron Prompts

Cron prompts run without a human in the loop. Design them to fail gracefully:

```
CronCreate({
  name: "deploy-monitor",
  cron: "0 */1 * * *",
  prompt: `Check deployment status with: gh run list --limit 5 --json status,conclusion,name

If any run failed, write a summary to .claude/deploy-failures/$(date +%Y-%m-%dT%H).md
If gh CLI fails (network issue), write "CHECK FAILED at $(date)" to .claude/deploy-failures/errors.log
If all runs passed or no runs, output nothing.`
})
```

Key practices:
- Write output to files rather than relying on display
- Handle tool failures explicitly
- Always include the "output nothing on success" clause
- Use absolute paths or ensure workingDirectory is set

---

## Testing a Cron Before Scheduling

Before registering with CronCreate, test the prompt manually:

1. Run the prompt directly in Claude Code to verify output format
2. Check that the "output nothing on no-change" branch works
3. Verify file write paths exist and are writable
4. Register with a fast interval first (`*/5 * * * *`), verify it fires, then switch to target interval
5. Delete the test schedule before going to production interval
