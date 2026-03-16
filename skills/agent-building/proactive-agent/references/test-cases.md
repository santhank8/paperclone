# Test Cases: proactive-agent

## Trigger Tests — Should Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| T1 | "How do I use CronCreate to schedule a daily task in Claude Code?" | TRIGGER | Core primitive — exact keyword match |
| T2 | "Build a heartbeat monitor that checks my deploy status silently" | TRIGGER | Heartbeat + silent monitoring use case |
| T3 | "I want my agent to poll GitHub for new PRs without being asked" | TRIGGER | "poll without being asked" — exact trigger phrase |
| T4 | "Set up a scheduled agent that runs every morning at 9am" | TRIGGER | "scheduled agent" + time-based scheduling |
| T5 | "How do I make my Claude Code agent proactive?" | TRIGGER | "proactive agent" — exact phrase |
| T6 | "Background agent that monitors Paperclip for issue changes" | TRIGGER | "background agent" + monitoring use case |
| T7 | "Create a cron job in Claude Code for weekly retros" | TRIGGER | "cron in claude code" + cron job framing |
| T8 | "Silent monitoring loop — only alert me when a deploy fails" | TRIGGER | "silent monitoring loop" — exact trigger phrase |
| T9 | "Agent that acts without being asked — check for PRs automatically" | TRIGGER | "agent that runs automatically" + autonomous action |
| T10 | "Schedule a task to run autonomously on a cron expression" | TRIGGER | "autonomous schedule" + "schedule a task" |
| T11 | "How do I save agent state before a Claude Code session ends?" | TRIGGER | State management use case — Stop hook |
| T12 | "Anticipatory agent that detects new issues and posts a digest" | TRIGGER | "anticipatory agent" trigger phrase |

## No-Trigger Tests — Should NOT Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| N1 | "Set up a cron job using systemd on Ubuntu" | NO TRIGGER | NOT for: external cron daemons |
| N2 | "Configure GitHub Actions to run tests on a schedule" | NO TRIGGER | NOT for: external cron daemons (GitHub Actions) |
| N3 | "How do I set up hooks in Claude Code for auto-formatting?" | NO TRIGGER | NOT for: hooks-only setup (see persistent-memory skill) |
| N4 | "What is a proactive person?" | NO TRIGGER | Not Claude Code related — no context signal |
| N5 | "Deploy my app automatically on every push" | NO TRIGGER | Deployment automation, not agent scheduling |

## Output Tests — Assertions Per Scenario

### T1: CronCreate basic usage
- [ ] Shows CronCreate({ name, cron, prompt, workingDirectory }) syntax
- [ ] Provides a working cron expression example
- [ ] Explains CronList and CronDelete for management
- [ ] Mentions the silence contract ("output nothing on no change")
- [ ] Does NOT reference external cron daemons

### T2: Heartbeat monitor setup
- [ ] Shows `/loop <interval> <prompt>` syntax
- [ ] Explicitly includes "output NOTHING" / silence contract instruction
- [ ] Explains state tracking (how to detect "changed")
- [ ] Covers rate considerations (don't poll too fast)
- [ ] Provides a copy-paste-ready example prompt

### T3: GitHub PR polling
- [ ] Shows how to use `gh pr list` in the cron prompt
- [ ] Explains cursor-based tracking (lastPRNumber pattern)
- [ ] Covers the "new since last check" logic
- [ ] Shows state file structure
- [ ] Silent unless new PRs found

### T4: Scheduled morning task
- [ ] Uses CronCreate (not /loop) — scheduled at fixed time
- [ ] Shows correct cron expression for 9am daily (`0 9 * * *`)
- [ ] Covers state accumulation between runs
- [ ] Includes the silence contract for no-items case

### T7: Weekly cron scheduling
- [ ] Shows correct cron expression for Monday 9am (`0 9 * * 1`)
- [ ] References CronList for verification
- [ ] Explains workingDirectory parameter
- [ ] Copy-paste-ready CronCreate call

### T8: Silent monitoring loop
- [ ] Makes silence contract the headline
- [ ] "NOTHING" is explicitly stated, not implied
- [ ] Covers what triggers the alert condition
- [ ] Shows state file comparison pattern

### T11: State persistence with Stop hook
- [ ] Shows `Stop` hook in `~/.claude/settings.json`
- [ ] Shows `SessionStart` hook for restoring state
- [ ] Includes `scheduled_tasks.lock` or state file pattern
- [ ] Explains graceful partial-run handling

## Scoring

Pass rate target: 80%+ trigger tests, 80%+ output assertions.

Trigger test score: __/12
No-trigger test score: __/5
Output test score: __/__
