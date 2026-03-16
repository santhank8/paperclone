---
name: tdd-workflow
category: dev-workflow
description: Implement test-driven development in Claude Code using the autonomous red-green-refactor loop. Use when writing failing tests first, running test suites and parsing failures, diagnosing test output, fixing code to make tests pass, or automating tests via PostToolUse hooks. Triggers on: "test-driven development", "tdd workflow", "write a failing test", "red-green-refactor", "test and fix", "parse test output", "diagnose test failure", "failing test first", "autonomous test loop", "PostToolUse hook for tests", "tdd loop in claude code", "red phase green phase". NOT for: CI/CD pipeline setup, test deployment to production, test coverage analysis tools, E2E/visual testing (use Playwright skill), property-based or mutation testing.
---

# Test-Driven Development in Claude Code

Claude Code has native TDD support — Bash for test execution, Read/Edit for fixes, subagents for isolation. The missing piece isn't tools. It's the loop: write failing test → run → parse failure → diagnose → fix → repeat → green → refactor. This skill teaches that autonomous cycle.

## Why TDD Fails Without a Loop

**The Problem**: Claude writes a test suite, runs it, then stops. The human copies failure output back, Claude reads it in context, makes a guess at the fix, and repeats. That's not TDD. That's supervised debugging.

**The Pattern**: TDD is a tight loop with structured handoffs:
1. Define behavior (test)
2. Run tests (get failure message)
3. Claude reads the output (not the human)
4. Claude edits the implementation
5. Claude re-runs automatically
6. Loop until green

When you automate steps 3-5, the loop accelerates. Claude stops after one edit when it could have run 5 iterations.

**This skill teaches** the primitives, the loop pattern, and a PostToolUse hook that auto-runs your tests on every Edit/Write. Result: red → green → refactor in one session, one conversation.

## Quick Entry

| Goal | Reference |
|---|---|
| Understand why one-shot test generation fails | [01-why-tdd-fails-without-a-loop.md](references/01-why-tdd-fails-without-a-loop.md) |
| Know which Claude Code tools support TDD natively | [02-native-tdd-primitives.md](references/02-native-tdd-primitives.md) |
| Write your first failing test correctly | [03-red-phase-failing-test.md](references/03-red-phase-failing-test.md) |
| Parse test output to extract the diagnosis | [04-running-and-parsing-output.md](references/04-running-and-parsing-output.md) |
| Make the minimal fix to pass the test | [05-green-phase-fix.md](references/05-green-phase-fix.md) |
| Refactor safely with tests as a net | [06-refactor-phase.md](references/06-refactor-phase.md) |
| Automate test runs with a PostToolUse hook | [07-automating-with-posttooluse-hook.md](references/07-automating-with-posttooluse-hook.md) |
| Walk through a complete TDD session end-to-end | [08-complete-tdd-session.md](references/08-complete-tdd-session.md) |

## The Feedback Loop in 60 Seconds

```
You write the failing test.
↓
Claude runs: bun test (or pytest, or xcodebuild test)
↓
Claude reads the failure output (via Bash output capture).
↓
Claude edits the implementation (minimal fix).
↓
Claude re-runs the test.
↓
Test passes? → Move to next test. Still red? → Loop.
```

No copy-paste. No human in the loop. Just read → edit → verify → next.

## Red-Green-Refactor Phases

| Phase | Goal | Key Rule |
|---|---|---|
| **Red** | Write a test that *currently fails* | Don't skip verification. Run it. See it fail. |
| **Green** | Make the test pass with minimal code | No architecture. Just make it green. |
| **Refactor** | Improve code while keeping tests green | Tests are your safety net. Edit with confidence. |

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "Let me write the implementation first, then tests" | Then you're testing existing code, not defining behavior. You lose the design phase. |
| "I'll run tests manually, I don't need a hook" | Manual runs = interrupts in the flow, skipped runs, stale test state. The hook takes 5 min to set up once. |
| "This failure is too complex, I'll debug outside Claude" | Copy-paste breaks the loop. Keep the context. Edit, re-run, see the next failure. |
| "I'll write 10 tests then implement" | Write one, make it green, refactor. Then the next. Small loops are faster loops. |
| "Test output is too noisy, I'll use a custom parser" | Jest, pytest, XCTest — all structured. Learn the format once. See [04-running-and-parsing-output.md](references/04-running-and-parsing-output.md). |
| "Refactoring without tests sounds risky" | That's exactly why you write tests first. Refactor with the net. |

## Prerequisites

- **Bash** (or Python, or Swift) — for running your test suite
- **A test framework** — Jest/Vitest (TypeScript), pytest (Python), XCTest (Swift)
- **Basic test syntax** — understand `describe`, `it`, `assert` concepts (if new, see [03-red-phase-failing-test.md](references/03-red-phase-failing-test.md))

No external services needed. No CI/CD setup required. This is local, synchronous, autonomous.
