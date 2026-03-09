---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, performance, reliability]
dependencies: []
---

# No Concurrency Limit on Outbound HTTP Requests

## Problem Statement

`dispatchNotification` uses `Promise.allSettled` to fire up to 20 concurrent HTTP requests per event (one per channel). With burst events and degraded external services, this can accumulate hundreds of in-flight connections with 10-second timeouts, causing resource exhaustion.

## Findings

**Source agents:** performance-oracle

**Evidence:**
- `server/src/services/notification.ts` lines 301-323 -- unbounded parallel HTTP requests
- Each notifier has 10-second timeout via AbortController
- 5 events in 100ms window * 20 channels = 100 concurrent connections
- No backpressure mechanism exists

**Affected files:**
- `server/src/services/notification.ts` - `dispatchNotification` method

## Proposed Solutions

### Option A: Add p-limit concurrency limiter (Recommended)
Use `p-limit(5)` to cap concurrent outbound requests.

- **Pros:** Simple, prevents resource exhaustion
- **Cons:** Adds a dependency (p-limit)
- **Effort:** Small (< 15 min)
- **Risk:** Low

### Option B: Reduce timeout to 5s + add circuit breaker
Reduce per-backend timeout and skip channels that fail N times consecutively.

- **Pros:** More comprehensive resilience
- **Cons:** More complex implementation
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

## Acceptance Criteria

- [ ] Maximum concurrent outbound HTTP requests is bounded
- [ ] Degraded external service does not cause unbounded connection accumulation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Fire-and-forget needs backpressure |
