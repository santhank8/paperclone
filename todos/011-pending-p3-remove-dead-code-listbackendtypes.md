---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Remove Dead Code: listBackendTypes()

## Problem Statement

`listBackendTypes()` is exported from the notification registry but never called anywhere in the codebase.

## Findings

**Source agents:** code-simplicity-reviewer

**Evidence:**
- `server/src/notifications/registry.ts` exports `listBackendTypes()`
- No consumers found via codebase search

## Proposed Solutions

Remove the function, or keep it if a discovery endpoint (todo 010) will use it.

- **Effort:** Trivial (< 5 min)

## Acceptance Criteria

- [ ] Either removed or used by a new endpoint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Exported but unused |
