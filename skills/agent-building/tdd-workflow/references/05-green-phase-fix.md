# Green Phase: Fix Without Over-Engineering

## The Goal

Make the failing test pass with the **minimum code change**. Not the best code, not the most general solution — the minimum.

This sounds counterintuitive. The point is: the test defines the requirement. The minimum implementation that satisfies the test is provably correct for that requirement. Over-engineering at this stage introduces untested behavior.

## The Diagnosis Step (Required)

Before touching the implementation, state the diagnosis:

> "The test expects `"$1.50"` but the function returns `"1.50"` — the dollar sign prefix is missing."

Don't skip this. Fixing before diagnosing leads to guessing. Guessing leads to changing three things at once, and then you don't know what worked.

**Prompt pattern:**
> "Diagnose the failure from the output. In one sentence, state what's wrong. Then make the minimal change."

## Minimal Fix Examples

### Missing dollar sign

```typescript
// Before
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);  // Returns "1.50"
}

// After (minimal fix — add the prefix)
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;  // Returns "$1.50"
}
```

### Wrong comparison type

```python
# Before
def is_valid_id(id: str) -> bool:
    return id == 42  # Always False — type mismatch

# After
def is_valid_id(id: str) -> bool:
    return id == "42"
```

### Off-by-one

```swift
// Before
func clamp(_ value: Int, min: Int, max: Int) -> Int {
    if value < min { return min }
    if value > max { return max }  // Should be >= max
    return value
}

// After
func clamp(_ value: Int, min: Int, max: Int) -> Int {
    if value < min { return min }
    if value >= max { return max }
    return value
}
```

## Re-Run After Every Fix

Never assume a fix worked. Re-run the specific failing test:

```bash
bun test src/format.test.ts 2>&1 | tail -10
```

If green, run the whole suite to catch regressions:

```bash
bun test 2>&1 | tail -10
```

If the whole suite is green, the green phase is complete. Move to refactor.

## When to Escalate to a Subagent

Some failures require significant implementation work (not a one-line fix). Signs:

- The function doesn't exist at all and has non-trivial logic
- The failure reveals an architectural problem (wrong data structure, wrong abstraction)
- 3+ attempts at the fix haven't worked

For these, spawn a subagent with clear constraints:

```
Subagent prompt:
"Implement [function name] to pass these tests: [paste test cases].
Do not add any behavior not tested. Return only the implementation file.
Tests: [paste test file]
Expected behavior: [paste failure output]"
```

The subagent focuses entirely on passing the tests, without the context of the broader feature that's accumulating in your main session.

## One Failure at a Time

When multiple tests fail, fix the first one listed, re-run, then move to the next. This prevents:
- Guessing which fix solved which problem
- Introducing a fix for test B that breaks test A (which was already passing)
- Context bloat from tracking N simultaneous failures
