# Complete TDD Session Walkthrough

A full cycle from failing spec to committed green code.

## The Feature

> "Add a `calculateDiscount(price: number, percent: number): number` function that applies a percentage discount and returns the discounted price, rounded to 2 decimal places."

## Step 1: Write the Failing Tests

**Prompt:**
> "Write failing tests for `calculateDiscount`. Test cases: (100, 10) → 90, (200, 25) → 150, (99.99, 0) → 99.99, (100, 100) → 0. The function doesn't exist yet."

**Claude produces:**

```typescript
// src/discount.test.ts
import { calculateDiscount } from './discount';

describe('calculateDiscount', () => {
  it('applies 10% to 100', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });
  it('applies 25% to 200', () => {
    expect(calculateDiscount(200, 25)).toBe(150);
  });
  it('applies 0% (no discount)', () => {
    expect(calculateDiscount(99.99, 0)).toBe(99.99);
  });
  it('applies 100% (free)', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });
});
```

## Step 2: Verify Red

**Prompt:**
> "Run the tests now. I expect them to fail — the module doesn't exist yet."

**Output:**
```
FAIL src/discount.test.ts
  ● Test suite failed to run
    Cannot find module './discount' from 'src/discount.test.ts'
```

Good. The test can fail. Proceed.

## Step 3: Green Phase — Minimal Implementation

**Prompt:**
> "Create the minimum implementation to pass these tests. Don't add any untested behavior."

**Claude produces:**

```typescript
// src/discount.ts
export function calculateDiscount(price: number, percent: number): number {
  const discount = price * (percent / 100);
  return Math.round((price - discount) * 100) / 100;
}
```

**Claude runs:**
```bash
bun test src/discount.test.ts
```

**Output:**
```
PASS src/discount.test.ts
  calculateDiscount
    ✓ applies 10% to 100 (2ms)
    ✓ applies 25% to 200 (1ms)
    ✓ applies 0% (no discount) (1ms)
    ✓ applies 100% (free) (1ms)

Test Suites: 1 passed
Tests:       4 passed
```

## Step 4: Regression Check

**Prompt:**
> "Run the full test suite to check for regressions."

```bash
bun test
```

```
Test Suites: 5 passed, 5 total
Tests:       23 passed, 23 total
```

Clean.

## Step 5: Refactor Phase

**Prompt:**
> "The tests are green. Any refactoring opportunities in the implementation? List them without changing anything yet."

**Claude:**
> - The rounding calculation `Math.round((price - discount) * 100) / 100` is a common pattern — could extract to a `roundToCents` helper if used elsewhere. For now, it's used once — leave it inline.
> - Variable naming is clear: `price`, `percent`, `discount`. No changes needed.
> - Magic number `100` appears twice — once for percent division, once for rounding. Different meanings — not worth extracting.

**Decision:** No refactoring needed. The implementation is minimal and clear for 4 lines.

## Step 6: Commit

```bash
git add src/discount.ts src/discount.test.ts
git commit -m "feat: add calculateDiscount function

Applies percentage discount to a price, rounded to 2 decimal places.
Covers 0%, partial, and 100% discount cases."
```

## What a Full Session Looks Like in Practice

The above took ~8 exchanges in a Claude Code session:
1. Write failing tests
2. Verify red
3. Write minimum implementation
4. Run tests (green)
5. Run full suite (no regressions)
6. Assess refactor opportunities
7. Decide no refactor needed
8. Commit

For a function with more complex logic, the loop would include multiple green→refactor cycles. But the structure is always the same: red → green → refactor → commit.

## Multi-Cycle Example

If the first implementation failed (e.g., floating point edge case), the loop extends:

```
Red → Green attempt 1 (fails: floating point) → Read output → Green attempt 2 → Run suite → Refactor → Commit
```

Each attempt: one diagnostic statement, one targeted edit, one re-run. Never multiple changes at once.
