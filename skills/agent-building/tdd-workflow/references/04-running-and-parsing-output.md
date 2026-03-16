# Running Tests and Parsing Output

## The Signal You Need

Every test runner produces two things on failure:
1. Which test failed (test name + file location)
2. Why it failed (expected vs. actual, or exception + stack trace)

The signal is always in the first 30-50 lines of output. After that, it's noise.

## How to Run Tests in Claude Code

### TypeScript (Jest/Vitest)

```bash
# Run a single test file (fastest signal)
bun test src/format.test.ts 2>&1 | head -40

# Run with failure details
bun test --reporter=verbose src/format.test.ts 2>&1 | head -60

# Run the whole suite (catch regressions)
bun test 2>&1 | tail -30
```

### Python (pytest)

```bash
# Single file, verbose
python -m pytest tests/test_format.py -v 2>&1 | head -50

# Short traceback (less noise)
python -m pytest tests/test_format.py --tb=short 2>&1 | head -40

# Stop at first failure
python -m pytest tests/test_format.py -x 2>&1 | head -40
```

### Swift/XCTest

```bash
xcodebuild test \
  -scheme MyApp \
  -destination 'platform=iOS Simulator,OS=26.2,name=iPhone 17 Pro' \
  2>&1 | grep -E 'FAILED|passed|error:|XCTAssert' | head -20
```

## Reading the Output

### Jest/Vitest failure

```
FAIL src/format.test.ts
  ● formatPrice › returns $1.50 for 150 cents

    expect(received).toBe(expected)

    Expected: "$1.50"
    Received: "1.50"       ← THE BUG IS HERE

      3 |   it('returns $1.50 for 150 cents', () => {
    > 4 |     expect(formatPrice(150)).toBe('$1.50');
        |                              ^
```

**What to extract:** `Expected: "$1.50"`, `Received: "1.50"` — the function is formatting correctly but missing the dollar sign.

### pytest failure

```
FAILED tests/test_format.py::test_format_price_150 - AssertionError: assert '$1.5' == '$1.50'
E   AssertionError: assert '$1.5' == '$1.50'
E     - $1.5
E     + $1.50
```

**What to extract:** The string diff shows a trailing zero is missing.

### Module not found (test can't even run)

```
Cannot find module '../format' from 'src/format.test.ts'
```

**What to extract:** The implementation file doesn't exist yet. Create it before trying to fix logic.

## Prompt Pattern for Claude

After running tests, use this prompt to feed Claude the failure context:

> "Read the test output above. Identify the first failing test. What is the mismatch between expected and actual? Make the minimal change to the implementation to fix it — do not modify the test."

This forces Claude to:
1. Localize to the first failure (not all at once)
2. State the diagnosis before fixing
3. Keep the fix minimal

## Limiting Output Volume

Test suites with 500 tests will dump thousands of lines on failure. Cap it:

```bash
bun test 2>&1 | head -50   # First 50 lines usually enough
bun test 2>&1 | tail -20   # Summary at end (pass/fail counts)
```

Or run only the failing test file directly instead of the whole suite. Fix one file, then run the suite to catch regressions.
