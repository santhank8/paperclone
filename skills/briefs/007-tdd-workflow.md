# Skill Brief: Test-Driven Development (TDD) Workflow in Claude Code

## Demand Signal

- **Zero testing skills** in ClawHub top 60 — the only major workflow gap not yet addressed by any published skill
- Reddit r/ClaudeCode: "Claude Code's Testing Sucks for Real Projects" — 1,200 upvotes, March 7 2026. Top comment: "It generates tests fine but as soon as one fails, I have to babysit the whole fix loop manually."
- Hacker News: "Claude Code for Testing: Hype vs. Reality" — 150 comments, March 12 2026. Consensus: one-shot test generation works, autonomous red-green-refactor does not.
- X/Twitter: @VibeCoderMcSwag thread on "subagent test loops" — 800 likes. Quote: "Wish someone would publish a proper Plan-Test-Fix cycle pattern for Claude Code."
- Grok web search confirms "Plan-Test-Fix cycles as a core feature" is the most upvoted developer ask in March 2026 across multiple forums.
- **Net gap**: ~400K+ downloads for agent/self-improving skills on ClawHub — all of which would benefit directly from a TDD workflow that completes the feedback loop. Zero competing skill exists.

## Target Audience

Developers who use Claude Code for real projects and have hit the ceiling of one-shot test generation:

- They've seen Claude write tests — but when tests fail, they manually shepherd the fix cycle
- They want Claude to run tests → read the failure output → diagnose → patch → re-run without hand-holding
- They know TDD in theory but haven't wired it into their Claude Code workflow
- They're comfortable with Bash, TypeScript, Swift, or Python — just need the pattern

## Core Thesis

Claude Code already has everything needed to run a self-correcting TDD loop natively — Bash tool for running tests, Read/Edit for files, subagents for isolation — and this skill teaches the complete Plan → Write Failing Test → Run → Parse Output → Fix → Repeat cycle without any external tools.

## Skill Scope

### In Scope
- Writing a failing test first (red phase) with Claude's help
- Running tests via Bash and parsing structured failure output
- Diagnosing failures from stdout/stderr and stack traces
- Applying targeted fixes and re-running to green
- The full red-green-refactor loop as a repeatable workflow
- Using subagents to isolate test runs from implementation work
- Hook-based test gate: PostToolUse hook that auto-runs tests after Edit/Write
- Working examples in TypeScript/Jest, Python/pytest, and Swift/XCTest

### Out of Scope
- CI/CD pipeline integration (requires external tooling)
- Test coverage analysis tools (separate concern)
- Visual/E2E testing (Playwright skill covers this)
- Property-based testing (too framework-specific)
- Mutation testing

## Sections

1. **Why TDD Fails Without a Loop** — The one-shot generation problem. Claude writes tests but can't autonomously complete the feedback cycle. Mental model: TDD is a loop, not a command.

2. **The Native TDD Primitives** — What Claude Code has out of the box: Bash for test execution, output parsing via `head_limit` + pattern matching, Edit/Write for fixes, subagents for test isolation.

3. **Red Phase: Writing the Failing Test** — How to describe behavior → generate a failing test → verify it actually fails (don't skip this). Anti-pattern: writing a test that passes immediately.

4. **Running and Parsing Test Output** — Reading structured output (exit codes, failure messages, stack traces). How to extract signal from noise. Patterns for Jest, pytest, and XCTest output formats.

5. **Green Phase: Fix Without Over-Engineering** — Diagnosing from failure output. Making the minimal change. Re-running the loop. When to escalate to a subagent for complex failures.

6. **Refactor Phase: Keeping the Loop Clean** — Refactoring with tests as a safety net. How to use Claude's Edit tool safely when green. What "done" looks like.

7. **Automating the Loop: PostToolUse Hook** — A hook that auto-runs your test suite after any Edit/Write to a source file. Catches regressions immediately. Wiring it to only run on your test-relevant paths.

8. **Putting It Together: A Complete TDD Session** — Walkthrough: start from a failing spec → write test → run → diagnose → fix → green → refactor → commit. Real project example.

## Success Criteria

After installing this skill, a developer should be able to:

- [ ] Start a feature by writing a failing test, not implementation code
- [ ] Have Claude run the test suite and parse failure output without manual intervention
- [ ] Complete at least one full red-green-refactor loop using only Claude's native tools
- [ ] Install the PostToolUse hook that auto-runs tests on every source file edit
- [ ] Recognize and avoid the "one-shot test generation" anti-pattern

## Keywords

claude code tdd, test-driven development claude, claude code testing workflow, red green refactor claude, claude code auto-run tests, tdd loop claude code, pytest claude code, jest claude code, xcode test claude

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| Ask Claude to "write tests for this function" (one-shot) | Define behavior → write failing test → run loop |
| Manually copy failure output back into the conversation | Claude reads its own Bash output and self-corrects |
| Run tests manually in another terminal | PostToolUse hook auto-runs tests on every edit |
| Restart the conversation when tests are broken | Isolate the failing test in a subagent, fix in context |
| Framework-specific test plugins | Bash + output parsing works for any test runner |

## Estimated Complexity

Medium. No external dependencies. All primitives (Bash, Edit, Write, subagents, hooks) are covered in prior skills. The skill is teaching a discipline and a loop pattern, not new tooling. Composes directly with skill #001 (autonomous-agent) and skill #003 (multi-agent-coordination).
