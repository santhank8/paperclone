# Native TDD Primitives in Claude Code

Claude Code ships everything needed for a TDD loop. No external tools, no plugins, no CI integration.

## The Four Primitives

### 1. Bash — Test Execution

```bash
# TypeScript/Jest/Vitest
bun test src/format.test.ts

# Python/pytest
python -m pytest tests/test_format.py -v

# Swift/XCTest (via xcodebuild)
xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,OS=26.2,name=iPhone 17 Pro' 2>&1 | tail -30
```

Claude Code's Bash tool captures both stdout and stderr. Test runners write failure output to stdout/stderr — Claude reads it all.

**Key parameter:** `head_limit` truncates long output to the first N lines. Use it to prevent context bloat from verbose test runners:

```
Run: bun test --verbose 2>&1 | head -50
```

### 2. Read — Code Inspection

When a test fails, Claude reads the failing test file AND the implementation file to understand what's diverging. This is why "read the error and fix it" works: Claude can inspect both sides of the failure simultaneously.

### 3. Edit/Write — Targeted Fixes

Edit makes surgical changes without rewriting the whole file. This is the fix tool for the green phase. One logical change per Edit call — don't bundle multiple fixes.

### 4. Subagents — Test Isolation

For complex failures where the fix requires significant refactoring, spawn a subagent to attempt the fix in isolation:

```
Spawn a subagent with:
- The failing test content
- The current implementation
- The failure output
- Instructions: "Make the minimal change to pass this test. Do not modify the test. Return the changed implementation only."
```

The subagent isolates the fix context, preventing the main conversation from accumulating debugging noise.

## Output Parsing Patterns

| Runner | Failure signal | Key lines to extract |
|--------|---------------|---------------------|
| Jest/Vitest | Non-zero exit code | `FAIL`, `●`, `Expected:`, `Received:` |
| pytest | Non-zero exit code | `FAILED`, `AssertionError`, `assert` lines |
| XCTest | Non-zero exit from xcodebuild | `Test Case ... failed`, `XCTAssertEqual failed` |
| go test | Non-zero exit code | `FAIL`, `--- FAIL:`, error lines |

## The Feedback Loop Contract

The loop works because of these guarantees:
1. Bash returns non-zero exit on test failure — Claude knows the tests failed
2. Test runners print failure location + expected vs. actual to stdout — Claude reads it
3. Edit changes exactly what's specified — no side effects
4. Re-running Bash gives a clean result — no state carries between runs

These aren't assumptions. They're the contract all major test runners honor.
