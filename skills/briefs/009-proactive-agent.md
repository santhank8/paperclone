# Skill Brief: Proactive Agent — Schedule, Monitor, and Act Without Being Asked

## Demand Signal

- ClawHub "Proactive Agent" skill: 101,904 downloads (#8 overall)
- ClawHub "Self-Improving + Proactive Agent": 73,597 downloads (#11)
- Combined: ~175K downloads for proactive/anticipatory agent patterns
- These are third-party ClawHub skills serving demand that Claude Code can handle natively
- ClawHub "Agent Browser" at 133K indicates high appetite for autonomous agent primitives generally
- No native Claude Code guide exists for CronCreate/heartbeat/scheduling — 100% of demand goes to third-party installs
- Pattern appears in multiple top-10 entries: developers want agents that *act*, not just *respond*

## Target Audience

Developers who have built reactive Claude Code setups and want their agents to:
- Check for changes (PRs, deploys, issues) without being asked
- Run recurring maintenance tasks on a schedule
- Monitor systems and alert proactively
- Handle background work without occupying the main conversation

They know hooks and CLAUDE.md. They want to add autonomous initiative.

## Core Thesis

Claude Code ships with native scheduling primitives — CronCreate, CronList, CronDelete, loop patterns, Stop hooks — that let agents act on their own schedule without being invoked. No third-party framework, no external cron daemon, no separate process manager. The skill teaches how to compose these primitives into an agent that monitors, schedules, and acts autonomously.

| Primitive | What It Does |
|---|---|
| `CronCreate` | Schedule a task to run on a cron expression |
| `CronList` / `CronDelete` | Manage and cancel active schedules |
| `/loop` skill | Recurring prompt execution at a fixed interval |
| Heartbeat pattern | Lightweight polling loop with silence on no-change |
| `Stop` hook | Save agent state before session ends |
| `SessionStart` hook | Restore state + process queued work on wake |

## Skill Scope

### In Scope
- Writing and registering a cron with CronCreate
- Building a heartbeat monitor that polls silently and alerts on change
- Using Stop hook for graceful state persistence
- Using SessionStart hook to process queued/scheduled work
- Implementing the "silent unless changed" pattern (no noise on quiet polls)
- End-to-end example: a PR/issue monitor that polls hourly and posts a morning digest
- Anti-patterns: over-polling, blocking the main loop, state loss on exit

### Out of Scope
- External cron daemons (cron daemon, launchd, GitHub Actions)
- Background process management (PM2, systemd)
- Building the initial agent structure (covered in skill #001 autonomous-agent)
- Memory system setup (covered in skill #002 persistent-memory)
- Multi-agent delegation (covered in skill #003 multi-agent-coordination)

## Sections

1. **From Reactive to Proactive** — Mental model shift: reactive agents answer questions, proactive agents anticipate needs. The three operating modes: scheduled (cron), polled (heartbeat), triggered (hook). When to use each.

2. **CronCreate Primitives** — CronCreate, CronList, CronDelete in action. Cron expression syntax. Writing your first scheduled task. Registering it. Use cases: daily digests, weekly retros, PR scans, dependency update checks.

3. **The Heartbeat Pattern** — Continuous lightweight monitoring with `/loop`. The silent-unless-changed contract (output NOTHING on quiet checks, alert only on change). Rate management. Real example: Paperclip CEO heartbeat monitoring for issue status changes.

4. **State Management Across Runs** — Using Stop hook to serialize agent state before exit. Using SessionStart to reload state and drain the work queue. The `scheduled_tasks.lock` file pattern. Handling partial runs gracefully.

5. **Building an End-to-End Monitor** — Walkthrough: a GitHub PR + issue monitor that polls hourly, detects new items since last check, posts a morning digest, and stays silent otherwise. Covers cron setup, state file, diff detection, alert formatting.

6. **Anti-Patterns and Rate Safety** — Over-polling (kills API budget), blocking the main loop with sync waits, recursive hook triggers, losing state on crash, ignoring the "silent on no-change" contract.

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Create a cron that runs daily and executes a prompt automatically
- [ ] Build a heartbeat monitor that polls a source and alerts only on change
- [ ] Use a Stop hook to save agent state before session ends
- [ ] Implement the silent-unless-changed contract in a polling loop
- [ ] Build one complete proactive agent: scheduled intake → check → alert → state save

## Keywords

claude code proactive agent, claude code cron, CronCreate, scheduled agent, heartbeat monitor, autonomous agent schedule, claude code polling, background agent, claude code loop, anticipatory agent

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| Install "Proactive Agent" from ClawHub (101K downloads) | Build it natively with CronCreate + hooks |
| Framework-managed scheduling — opaque lifecycle | Claude Code's built-in cron — inspectable, debuggable |
| Fixed poll behaviors you can't override | Configure exactly what triggers and how |
| Framework updates can break your agent | You own every line — nothing to upgrade |
| Separate process running outside Claude Code | Fully integrated — shares context, state, tools |

## Estimated Complexity

Medium. No external dependencies. CronCreate/CronList/CronDelete are documented native tools. The heartbeat pattern is proven in production (Paperclip CEO heartbeat). The skill is teaching composition of existing primitives, not introducing new concepts.
