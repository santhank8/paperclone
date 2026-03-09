---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, types, type-safety]
dependencies: []
---

# Tighten Shared Types to Use Union Types

## Problem Statement

`NotificationChannel.channelType` and `NotificationEvent.type` are typed as `string` instead of their corresponding union types (`NotificationChannelType` and `NotificationEventType`), losing compile-time safety that the runtime validators already enforce.

## Findings

**Source agents:** architecture-strategist

**Evidence:**
- `packages/shared/src/types/notification-channel.ts` line 5: `channelType: string` (should be `NotificationChannelType`)
- `packages/shared/src/types/notification-channel.ts` line 14: `type: string` (should be `NotificationEventType`)

## Proposed Solutions

### Option A: Change types to union types
- **Effort:** Small (< 10 min)
- **Risk:** Low (may surface type errors in consumers, which is the point)

## Acceptance Criteria

- [ ] `channelType` is `NotificationChannelType`
- [ ] `type` on `NotificationEvent` is `NotificationEventType`
- [ ] Code compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Runtime validation exists, static types should match |
