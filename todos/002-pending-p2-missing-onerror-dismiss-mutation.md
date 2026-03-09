---
status: wontfix
priority: p2
issue_id: "002"
tags: [code-review, quality, frontend]
dependencies: []
---

# Missing onError Handler on dismissRunMutation

## Problem Statement

In `ui/src/pages/Inbox.tsx:528-536`, the `dismissRunMutation` lacks an `onError` handler. Other mutations in the same file (e.g., cancel mutation) include `onError` handlers that show toast notifications. If a dismiss request fails (network error, 403, 500), the user gets no feedback.

## Findings

- **Location**: `ui/src/pages/Inbox.tsx:528-536`
- **Severity**: Important - poor UX on failure
- **Evidence**: Other mutations in the file follow the pattern of including `onError` with toast notifications
- **Identified by**: 4 of 8 review agents (TypeScript reviewer, pattern recognition, code simplicity, architecture)

## Proposed Solutions

### Solution 1: Add onError with toast notification (Recommended)

```typescript
const dismissRunMutation = useMutation({
  mutationFn: (runId: string) => heartbeatsApi.dismiss(runId),
  onSuccess: () => {
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(selectedCompanyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId) });
    }
  },
  onError: () => {
    toast.error("Failed to dismiss run");
  },
});
```

- **Pros**: Consistent with existing patterns, good UX
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Technical Details

- **Affected files**: `ui/src/pages/Inbox.tsx`
- **Components**: Inbox page dismiss mutation

## Acceptance Criteria

- [ ] `dismissRunMutation` has an `onError` handler
- [ ] Toast notification shown on dismiss failure
- [ ] Consistent with other mutation error handling patterns in the file

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Identified during code review | Pattern inconsistency with other mutations |
