# Refactor Phase: Keeping the Loop Clean

You've written multiple tests. They all pass. Now improve the code while keeping tests green as a safety net.

## Refactor Phase Discipline

In refactor phase, you improve code structure, remove duplication, and optimize — *without changing behavior*.

**The safety net:** All your tests still pass when you're done. If a test breaks, you changed behavior. Stop.

## Pattern: Test → Edit → Test

```
All tests pass (green)
   ↓
Edit the code structure
   ↓
Run all tests again
   ↓
Still passing? Great, refactor worked
Still failing? Revert the edit
```

## What Refactor Phase Is NOT

❌ Adding new features ("While I'm here, let me add error handling")
❌ Changing the API ("I'll rename this parameter")
❌ Optimizing for performance without a test ("This loop is slow, let me cache it")

**All of those are new behaviors.** Write a test first, then implement.

## Examples: Safe Refactors

### Example 1: Extract a Helper Function

**Before:**
```typescript
function add(a: number, b: number): number {
  const result = a + b;
  return result;
}
```

**After:**
```typescript
function sum(a: number, b: number): number {
  return a + b;
}

function add(a: number, b: number): number {
  return sum(a, b);
}
```

**Tests:** Still pass. Behavior unchanged.

### Example 2: Rename a Variable

**Before:**
```python
def add(a, b):
    x = a + b
    return x
```

**After:**
```python
def add(a, b):
    total = a + b
    return total
```

**Tests:** Still pass. Behavior unchanged.

### Example 3: Remove Duplication

**Before:**
```typescript
function double(x: number): number {
  return x * 2;
}

function triple(x: number): number {
  return x * 3;
}
```

**After:**
```typescript
function multiply(x: number, factor: number): number {
  return x * factor;
}

function double(x: number): number {
  return multiply(x, 2);
}

function triple(x: number): number {
  return multiply(x, 3);
}
```

**Tests:** Still pass. Behavior unchanged.

## The Refactor Checklist

- [ ] All existing tests pass before refactoring
- [ ] You're only changing code structure, not behavior
- [ ] You've run all tests after each refactor
- [ ] All tests still pass
- [ ] You can revert any change if a test fails

## Anti-Pattern: Refactoring Without Tests

❌ "I'll refactor this code, but I don't have tests for it"

→ Risky. You'll probably break something. Write tests first, then refactor.

❌ "I'll refactor and test manually at the end"

→ Manual testing is unreliable. Run the automated tests after each change.

## When to Stop Refactoring

- [ ] Code is clear and maintainable
- [ ] No obvious duplication remains
- [ ] All tests pass
- [ ] You're not guessing at further improvements

Don't over-polish. Done is better than perfect. If you find yourself refactoring the same section three times, stop and move on.

## Connecting the Phases: A Full Cycle

```
Write failing test (red)
   ↓
Make minimal fix (green)
   ↓
Test passes (green)
   ↓
Write next failing test (red)
   ↓
Make minimal fix (green)
   ↓
Test passes (green)
   ↓
(repeat until feature is complete)
   ↓
All tests pass, all behaviors defined
   ↓
Refactor to clean up structure
   ↓
All tests still pass
   ↓
Feature complete
```

This is the TDD loop. Each phase has a job. Do one phase at a time.
