---
name: cicd-automation
description: Deterministic quality gates for Claude Code — Stop hook runs tests before every git commit, PreToolUse hook blocks pushes when red, gh CLI pulls CI failure logs directly into context for auto-fix. Use when Claude committed code without running tests, when you need a guardrail that cannot be skipped, or when CI failures need analysis without leaving Claude Code. Triggers on: "claude skipped tests", "committed broken code", "test before commit", "pre-commit hook", "ci failure analysis", "gh run view", "quality gate", "stop hook testing", "ci/cd claude code", "github actions failure", "auto-fix ci", "blocking commit", "run tests before commit", "never commit without tests", "claude never runs tests", "agent shipped broken code", "hook to run tests", "gh run watch", "ci pipeline claude", "failing ci auto-fix", "tests before push", "pre-push guard". NOT for: generating GitHub Actions workflow YAML files, Docker/Kubernetes config, cloud deployment (Vercel, Railway, AWS), performance/load testing infrastructure.
---

# CI/CD Automation

Three deterministic gates that prevent Claude from shipping broken code:

| Gate | Hook Type | What It Stops |
|---|---|---|
| Pre-commit test runner | Stop | Committing with failing tests |
| Pre-push guard | PreToolUse | Pushing when tests are red |
| CI failure auto-fix | gh CLI loop | Broken CI staying broken |

---

## Quick Setup

### 1. Detect and cache the test command

→ Run `detect-test-command.sh` to write `.claude/test-command.txt`. Auto-detection logic for 6 runtimes: `references/test-command-discovery.md`

### 2. Wire the Stop hook (pre-commit gate)

→ Full hook scripts + settings.json registration: `references/pre-commit-stop-hook.md`, `references/pre-push-hook.md`

---

## Why Checklists Fail and Hooks Don't

CLAUDE.md rules and task checklists live inside the reasoning loop — under agentic pace, they get skipped. Hooks execute outside the reasoning loop: Claude physically cannot commit without tests passing.

→ Evidence from GitHub #35042 + failure taxonomy: `references/why-hooks-not-checklists.md`

---

## CI Failure Analysis Loop

→ `gh run list`, `gh run watch`, `gh run view --log-failed` pull failure logs directly into context. Full loop + escalation rule (max 3 attempts): `references/ci-failure-loop.md`

---

## PR Gate Integration

→ `gh pr checks <pr-number> --watch` exits non-zero if any check fails. Integration with structured-project-workflow (#008) + merge block pattern: `references/pr-gate.md`

---

## CLAUDE.md Configuration

→ Full template + escalation rules: `references/claude-md-config.md`

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "The change was small — tests aren't needed" | The hook doesn't know what's small. Neither do you. Small changes break things. |
| "The tests take too long — I'll skip just this once" | Configure a fast subset. Don't disable the gate. One broken commit = hours of debugging. |
| "CI will catch it" | CI catches it after the push. The Stop hook catches it before. Pre-commit is always cheaper. |
| "I'll fix the CI failure manually later" | Later never comes. Wire the auto-fix loop now and it runs itself. |

