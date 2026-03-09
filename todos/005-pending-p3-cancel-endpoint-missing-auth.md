---
status: wontfix
priority: p3
issue_id: "005"
tags: [code-review, security, authorization, pre-existing]
dependencies: []
---

# Pre-existing: Cancel Endpoint Missing assertCompanyAccess

## Problem Statement

In `server/src/routes/agents.ts:1349-1367`, the cancel endpoint has no `assertCompanyAccess` check at all. This is a pre-existing issue (not introduced in this branch) but was noted by 6 of 8 review agents.

## Findings

- **Location**: `server/src/routes/agents.ts:1349-1367`
- **Severity**: Nice-to-have (out of scope for this PR, pre-existing)
- **Evidence**: The cancel endpoint only calls `assertBoard(req)` but never verifies the run belongs to the requesting user's company
- **Identified by**: 6 of 8 review agents

## Proposed Solutions

### Solution 1: Add assertCompanyAccess to cancel endpoint

Follow the same read-check-mutate pattern recommended for the dismiss endpoint.

- **Pros**: Fixes cross-tenant vulnerability
- **Cons**: Out of scope for this PR
- **Effort**: Small
- **Risk**: Low

## Technical Details

- **Affected files**: `server/src/routes/agents.ts`
- **Note**: This is a pre-existing issue, not introduced by this branch

## Acceptance Criteria

- [ ] Cancel endpoint verifies company access before cancellation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Identified during code review | Pre-existing issue, noted for separate fix |
