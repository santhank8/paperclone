---
status: wontfix
priority: p3
issue_id: "004"
tags: [code-review, quality, backend]
dependencies: []
---

# Two new Date() Calls in dismissRun

## Problem Statement

In `server/src/services/heartbeat.ts:2293`, the `dismissRun` method calls `new Date()` twice in the `.set()` clause - once for `dismissedAt` and once for `updatedAt`. These could produce slightly different timestamps (microseconds apart).

## Findings

- **Location**: `server/src/services/heartbeat.ts:2293`
- **Severity**: Nice-to-have - negligible practical impact
- **Evidence**: `{ dismissedAt: new Date(), updatedAt: new Date() }`
- **Identified by**: 2 of 8 review agents (TypeScript reviewer, pattern recognition)

## Proposed Solutions

### Solution 1: Use a shared `now` variable (Recommended)

```typescript
const now = new Date();
const [updated] = await db
  .update(heartbeatRuns)
  .set({ dismissedAt: now, updatedAt: now })
  .where(eq(heartbeatRuns.id, runId))
  .returning();
```

- **Pros**: Guarantees identical timestamps, cleaner
- **Cons**: Trivial change
- **Effort**: Small
- **Risk**: None

## Technical Details

- **Affected files**: `server/src/services/heartbeat.ts`

## Acceptance Criteria

- [ ] Single `new Date()` call used for both fields

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Identified during code review | Minor timestamp consistency issue |
