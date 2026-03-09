---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, performance, reliability]
dependencies: []
---

# Reduce Notification HTTP Timeout from 10s to 5s

## Problem Statement

All three notifier backends use 10-second timeouts for HTTP requests. Notifications are best-effort; 5 seconds is generous enough for webhook/Discord/ntfy calls. Shorter timeouts reduce resource holding during external service degradation.

## Findings

**Source agents:** performance-oracle

**Evidence:**
- `packages/notifiers/webhook/src/index.ts` line 74: `setTimeout(() => controller.abort(), 10_000)`
- `packages/notifiers/discord/src/index.ts` line 97: same
- `packages/notifiers/ntfy/src/index.ts` line 92: same

## Proposed Solutions

Change `10_000` to `5_000` in all three packages. Consider extracting the timeout constant to be configurable.

- **Effort:** Trivial (< 5 min)

## Acceptance Criteria

- [ ] All notifier timeouts reduced to 5 seconds

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Best-effort delivery doesn't need 10s timeout |
