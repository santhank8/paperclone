---
name: systematic-debugging
description: Systematic debugging methodology for Claude Code. Installs three disciplines: pre-commit Stop hook (blocks broken commits), reproduce-first protocol (failing test before any fix), and hypothesis-driven debug loop (root cause tracing, not symptom chasing). Use when debugging AI-generated code, setting up pre-commit test gates, tracing root causes, or building a repeatable debug workflow. Triggers on: "debug workflow", "pre-commit test hook", "stop hook for tests", "root cause analysis", "reproduce the bug", "hypothesis-driven debugging", "broken commits", "debug session log", "regression test workflow", "systematic debugging", "test before commit", "claude code debugging", "debug session", "I keep debugging for hours", "spend hours debugging", "spending hours debugging", "55% debugging", "55% of my time debugging", "code breaks and I spend hours". NOT for: production monitoring (Sentry/Datadog), IDE debugger integration (DAP), distributed tracing.
---

# Systematic Debugging

Claude Code generates code fast — debugging it eats back all the time you saved because no methodology means every bug is a fresh hunt. This skill installs three disciplines:

1. **Pre-commit Stop hook** — blocks the session from ending until tests pass
2. **Reproduce-first protocol** — never touch an error without a failing test that pins it
3. **Hypothesis-driven loop** — ranked bets tested in order, root cause found first

All native Claude Code primitives. No external tools. Composes with TDD Workflow (#007) and Self-Improving Agent (#010).

---

## Quick Setup

Two hooks in `~/.claude/settings.json` — full scripts and config: `references/pre-commit-stop-hook.md` and `references/debug-session-log.md`

---

## Why Debugging Eats 55% of Your Time

"Just paste the error and ask Claude to fix it" creates fix-break-fix loops: no reproducer = guessing, no hypothesis = random changes, no root cause = same bug resurfaces. Each discipline below eliminates one failure mode.

---

## The Pre-Commit Stop Hook

Runs your test suite before every Claude session exits. Exit 1 = blocked. Claude sees the output and must fix before it can finish. Auto-detects bun/npm/pytest/cargo from project root. → `references/pre-commit-stop-hook.md`

---

## Reproduce First

**Rule:** Never attempt a fix without a failing test that reproduces the issue. Ask Claude: *"Write a minimal test that triggers this exact error"* — confirm it fails, then fix. Without a pinned reproducer, the fix is a guess.

---

## The Hypothesis Loop

Form 3 hypotheses ranked by likelihood, test each in order, cross off eliminated paths. Prevents shotgun debugging: random changes, endless retries, Claude confidently "fixing" symptoms.

→ Full procedure + Agent tool delegation patterns: `references/hypothesis-loop.md`

---

## Root Cause vs. Symptom

Surface errors (`undefined`, `NullPointerException`, `500`) almost never describe the actual problem. Apply the 5 Whys to trace from symptom to root cause — fix that, not the symptom.

→ Error chain tracing + 5 Whys templates: `references/root-cause-tracing.md`

---

## Debug Session Log

PostToolUse hook on Bash writes each debugging attempt to `debug-log.md`. Never repeat a dead end. Feeds the self-improving loop. → `references/debug-session-log.md`

---

## Regression Prevention

Every fix ships with a test that would have caught the bug. **Rule:** No regression test = bug is temporarily absent, not fixed. The pre-commit gate grows more protective with each fix.

→ Regression test templates: `references/regression-prevention.md`

---

## The Full Loop

**Pre-commit catches it → reproduce → hypothesize → root cause → fix → regression test → commit passes**

Typical bug: < 30 min. → End-to-end walkthrough: `references/full-workflow-walkthrough.md`

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I'll just paste the error and ask Claude to fix it" | That's symptom-chasing. Without a hypothesis, every fix is a guess. Guesses compound. |
| "I understand the bug, I don't need a reproducer" | You think you understand it. The failing test proves you do. Skip it and find out the hard way. |
| "The Stop hook will slow me down" | It blocks you for 30 seconds when tests fail. The alternative is debugging broken commits for 30 minutes. |
| "I found the problem, no need to trace root cause" | You found a symptom. The root cause is why the symptom exists. Skip it and the bug comes back. |
| "I'll skip the regression test this time" | That bug is the one you debug again in three weeks without a test protecting it. |
