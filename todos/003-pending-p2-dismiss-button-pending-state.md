---
status: wontfix
priority: p2
issue_id: "003"
tags: [code-review, quality, frontend, ux]
dependencies: []
---

# No Pending/Disabled State on Dismiss Button

## Problem Statement

In `ui/src/pages/Inbox.tsx:779`, the dismiss button has no loading or disabled state while the mutation is in progress. Users can click dismiss multiple times, and there's no visual feedback that the action is processing.

## Findings

- **Location**: `ui/src/pages/Inbox.tsx:779`
- **Severity**: Important - potential double-submit, poor UX
- **Evidence**: The dismiss operation is idempotent (server returns existing run if already dismissed), so double-clicks won't corrupt data, but UX is suboptimal
- **Identified by**: 2 of 8 review agents (TypeScript reviewer, code simplicity)

## Proposed Solutions

### Solution 1: Add disabled/loading state to dismiss button (Recommended)

Pass `dismissRunMutation.isPending` to disable the button and optionally show a spinner.

- **Pros**: Better UX, prevents unnecessary API calls
- **Cons**: Minimal code change needed
- **Effort**: Small
- **Risk**: Low

## Technical Details

- **Affected files**: `ui/src/pages/Inbox.tsx`
- **Components**: Dismiss button in inbox failed runs section

## Acceptance Criteria

- [ ] Dismiss button is disabled while mutation is pending
- [ ] Visual loading indicator shown during dismiss

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Identified during code review | Idempotent server-side, but UX should still reflect pending state |
