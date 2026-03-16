# Red Phase: Writing the Failing Test

## The Goal

Write a test that:
1. Describes the behavior you want (not the implementation you'll write)
2. Fails when you run it — proving it can detect the missing behavior
3. Is specific enough to guide a minimal implementation

## How to Describe Behavior to Claude

Be concrete about inputs and outputs:

**Weak (implementation-biased):**
> "Write a test for the formatPrice function."

**Strong (behavior-first):**
> "Write a failing test for a `formatPrice(cents: number): string` function. Input 150 should return `"$1.50"`. Input 0 should return `"$0.00"`. Input 1050 should return `"$10.50"`. The function doesn't exist yet — the test should fail on import."

The key: the function doesn't exist yet. The test should fail immediately.

## Verify the Test Fails

This step is non-negotiable. Always run the test before writing any implementation:

```
Claude: Run this test now. I expect it to fail. Show me the exact failure output.
```

If the test passes before you write implementation — the test is broken. Either it's testing the wrong thing, the function already exists somewhere, or the assertion is wrong.

A test that passes immediately tells you nothing. You need to see:

```
FAIL src/format.test.ts
  ● formatPrice › returns $1.50 for 150 cents
    Cannot find module '../format' from 'src/format.test.ts'
```

or

```
● formatPrice › returns $1.50 for 150 cents
    Expected: "$1.50"
    Received: undefined
```

Either failure proves the test can detect what's missing.

## Test Templates

### TypeScript/Jest or Vitest

```typescript
// src/format.test.ts
import { formatPrice } from './format';

describe('formatPrice', () => {
  it('returns $1.50 for 150 cents', () => {
    expect(formatPrice(150)).toBe('$1.50');
  });

  it('returns $0.00 for 0 cents', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('returns $10.50 for 1050 cents', () => {
    expect(formatPrice(1050)).toBe('$10.50');
  });
});
```

### Python/pytest

```python
# tests/test_format.py
from format import format_price

def test_format_price_150():
    assert format_price(150) == "$1.50"

def test_format_price_zero():
    assert format_price(0) == "$0.00"

def test_format_price_1050():
    assert format_price(1050) == "$10.50"
```

### Swift/XCTest

```swift
// FormatTests.swift
import XCTest
@testable import MyApp

final class FormatPriceTests: XCTestCase {
    func testFormatPrice150() {
        XCTAssertEqual(formatPrice(cents: 150), "$1.50")
    }

    func testFormatPriceZero() {
        XCTAssertEqual(formatPrice(cents: 0), "$0.00")
    }
}
```

## Anti-Pattern: The Test That Passes First

```typescript
// This is NOT a failing test — it always passes
it('formatPrice returns a string', () => {
  expect(typeof formatPrice(100)).toBe('string');
});
```

This passes the moment `formatPrice` exists and returns anything. It tests the type, not the behavior. You want behavior-level assertions: specific input, specific expected output.

## One Test Per Behavior

Write one test per distinct behavior, not one test per function. A function with 3 edge cases needs 3 tests. Starting with one behavior and making it green before adding the next is faster than writing all tests first and then drowning in failures.
