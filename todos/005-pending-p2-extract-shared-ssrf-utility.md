---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, architecture, dry, security]
dependencies: ["001"]
---

# Extract Duplicated SSRF Protection Into Shared Utility

## Problem Statement

The `BLOCKED_HOSTS`, `PRIVATE_IP_PREFIXES`, and `isBlockedUrl()` function are copy-pasted identically across webhook and discord notifier packages (~25 lines each). ntfy has its own copy. This DRY violation will compound as more notifier backends are added.

## Findings

**Source agents:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer

**Evidence:**
- `packages/notifiers/webhook/src/index.ts` lines 7-36
- `packages/notifiers/discord/src/index.ts` lines 6-27
- `packages/notifiers/ntfy/src/index.ts` lines 8-29
- Identical logic in all three files

**Affected files:**
- All three notifier packages
- Either `@paperclipai/shared` or new `@paperclipai/notifier-utils` package

## Proposed Solutions

### Option A: Add to @paperclipai/shared (Recommended)
Export `isBlockedUrl` from the shared package. All notifiers already depend on it.

- **Pros:** No new package, minimal change
- **Cons:** Shared package gets slightly larger
- **Effort:** Small (< 30 min)
- **Risk:** Low

### Option B: Create @paperclipai/notifier-utils package
New shared package for notifier utilities including SSRF, timeout wrapper, event labels.

- **Pros:** Clean separation of concerns
- **Cons:** Another package to maintain
- **Effort:** Medium (1 hour)
- **Risk:** Low

## Acceptance Criteria

- [ ] Single source of truth for SSRF protection
- [ ] All three notifier packages import from shared location
- [ ] No duplicated SSRF code across packages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | 25 lines duplicated 3x |
