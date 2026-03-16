# Test Cases: tdd-workflow

## Trigger Tests — Should Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| T1 | "How do I implement test-driven development in Claude Code?" | TRIGGER | Core use case |
| T2 | "Write a failing test first, then implement" | TRIGGER | Red-green-refactor pattern |
| T3 | "My test is failing — how do I parse the output and fix it?" | TRIGGER | Debug/parsing use case |
| T4 | "Set up a PostToolUse hook to auto-run tests" | TRIGGER | Automation use case |
| T5 | "Red-green-refactor loop for building features" | TRIGGER | Core TDD pattern |
| T6 | "How do I isolate failing tests with subagents?" | TRIGGER | Subagent coordination |
| T7 | "Implement a feature using TDD — start with a failing test" | TRIGGER | End-to-end workflow |
| T8 | "Run tests and diagnose failures in one loop" | TRIGGER | Test feedback cycle |
| T9 | "tdd workflow in claude code" | TRIGGER | Exact phrase match |
| T10 | "Make tests pass with minimal code changes" | TRIGGER | Green phase discipline |
| T11 | "Autonomous test loop — tests run after every edit" | TRIGGER | Loop automation |
| T12 | "Refactor code while keeping all tests passing" | TRIGGER | Refactor phase safety |

## No-Trigger Tests — Should NOT Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| N1 | "Set up CI/CD for automated testing" | NO TRIGGER | Out of scope — deployment |
| N2 | "Generate test coverage reports" | NO TRIGGER | Out of scope — analysis tools |
| N3 | "How do I use Playwright for E2E testing?" | NO TRIGGER | Different tool — use Playwright skill |
| N4 | "Implement property-based testing with Hypothesis" | NO TRIGGER | Out of scope — specific framework |
| N5 | "How do mutation testing help catch bugs?" | NO TRIGGER | Out of scope — mutation testing |

## Output Tests — Assertions Per Scenario

### T1: Basic TDD in Claude Code question
- [ ] Explains the feedback loop (write test → run → parse → fix → repeat)
- [ ] Mentions red-green-refactor phases
- [ ] References the native Claude Code tools (Bash, Edit, Read)
- [ ] Shows a code example of a failing test
- [ ] Does NOT mention CI/CD or external test runners

### T2: Red-green-refactor pattern
- [ ] Describes what each phase does (red: define, green: implement, refactor: improve)
- [ ] Explains why the order matters (test-first design)
- [ ] Shows minimal implementation example (hardcoded value → generalized)
- [ ] Includes anti-rationalization table or explanation
- [ ] Provides at least one complete example cycle

### T3: Parsing test output and fixing
- [ ] Shows how to read Jest/pytest/XCTest output
- [ ] Extracts key signals (Expected vs Received)
- [ ] Forms a hypothesis about what's wrong
- [ ] Applies a targeted fix based on the diagnosis
- [ ] Re-runs the test to verify
- [ ] No copy-pasting between Claude and human

### T4: PostToolUse hook setup
- [ ] Shows `~/.claude/settings.json` or `.claude/settings.json` hook configuration
- [ ] Includes trigger (Edit), condition (file path), action (test command)
- [ ] Excludes test files from triggering (prevents loops)
- [ ] Provides examples for Jest, pytest, and XCTest
- [ ] Explains how to verify the hook is working

### T7: End-to-end TDD session
- [ ] Starts with a feature requirement (no code)
- [ ] Writes a failing test (red)
- [ ] Makes minimal implementation (green)
- [ ] Tests pass and are verified
- [ ] Adds more tests and implements features iteratively
- [ ] Refactors to clean up structure
- [ ] Final result is tested, documented, and committed

### T8: Autonomous test loop
- [ ] Runs a test via Bash, captures output
- [ ] Claude reads the failure immediately (no manual copy-paste)
- [ ] Claude edits the code based on the failure
- [ ] Claude re-runs the test automatically
- [ ] Loop continues until test passes
- [ ] No human intervention between edit and re-run

## Scoring

Pass rate target: 80%+ on trigger tests, 80%+ on output assertions.

Trigger test score: __/12
Output test score: __/__ assertions passed
