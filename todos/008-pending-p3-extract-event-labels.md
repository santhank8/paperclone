---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, dry, architecture]
dependencies: ["005"]
---

# Extract Duplicated EVENT_LABELS to Shared Package

## Problem Statement

The `EVENT_LABELS` record mapping event types to human-readable strings is duplicated identically between discord and ntfy notifier packages.

## Findings

**Source agents:** architecture-strategist, pattern-recognition-specialist, code-simplicity-reviewer

**Evidence:**
- `packages/notifiers/discord/src/index.ts` lines 42-53
- `packages/notifiers/ntfy/src/index.ts` lines 57-68
- Identical 12-line maps

**Affected files:**
- `packages/notifiers/discord/src/index.ts`
- `packages/notifiers/ntfy/src/index.ts`
- `@paperclipai/shared` (destination)

## Proposed Solutions

### Option A: Add NOTIFICATION_EVENT_LABELS to @paperclipai/shared
Export alongside `NOTIFICATION_EVENT_TYPES` in constants.

- **Effort:** Small (< 15 min)
- **Risk:** None

## Acceptance Criteria

- [ ] Single source of truth for event labels
- [ ] Both discord and ntfy import from shared

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | 12 lines duplicated 2x |
