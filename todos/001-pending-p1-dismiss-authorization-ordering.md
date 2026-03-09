---
status: done
priority: p1
issue_id: "001"
tags: [code-review, security, authorization]
dependencies: []
---

# Authorization Ordering Bug in Dismiss Endpoint

## Problem Statement

In `server/src/routes/agents.ts:1369-1388`, the dismiss endpoint calls `heartbeat.dismissRun(runId)` (which mutates the database) **before** calling `assertCompanyAccess(req, run.companyId)`. This means the database mutation is committed before authorization is verified. A board user from Company A could dismiss heartbeat runs belonging to Company B.

This was identified independently by all 8 review agents with unanimous consensus.

## Findings

- **Location**: `server/src/routes/agents.ts:1369-1388`
- **Severity**: Critical - cross-tenant data mutation without authorization
- **Evidence**: The dismiss endpoint pattern differs from the correct pattern used in the events endpoint (lines 1390-1407), which reads first, checks access, then proceeds.
- **Current code flow**: `assertBoard` -> `dismissRun` (MUTATE) -> `assertCompanyAccess` (TOO LATE)
- **Correct flow**: `assertBoard` -> `getRun` (READ) -> `assertCompanyAccess` -> `dismissRun` (MUTATE)

## Proposed Solutions

### Solution 1: Read-then-check-then-mutate (Recommended)

Split the operation: first read the run to get `companyId`, verify access, then dismiss.

```typescript
router.post("/heartbeat-runs/:runId/dismiss", async (req, res) => {
  assertBoard(req);
  const runId = req.params.runId as string;
  const existing = await heartbeat.getRun(runId);
  if (!existing) {
    res.status(404).json({ error: "Heartbeat run not found" });
    return;
  }
  assertCompanyAccess(req, existing.companyId);
  const run = await heartbeat.dismissRun(runId);
  // ... activity log and response
});
```

- **Pros**: Follows existing patterns in codebase (events endpoint), minimal change, clear
- **Cons**: Extra DB read (negligible cost)
- **Effort**: Small
- **Risk**: Low

### Solution 2: Pass companyId into dismissRun for internal check

Add companyId parameter to `dismissRun` and have it verify internally.

- **Pros**: Encapsulates authorization logic
- **Cons**: Changes service interface, mixes concerns (auth in service layer)
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Solution 1 - matches existing patterns in the codebase.

## Technical Details

- **Affected files**: `server/src/routes/agents.ts`
- **Components**: Heartbeat runs dismiss endpoint
- **Database changes**: None (code-only fix)

## Acceptance Criteria

- [x] `assertCompanyAccess` is called BEFORE any mutation in the dismiss endpoint
- [x] A user from Company A cannot dismiss runs belonging to Company B
- [x] The dismiss endpoint follows the same read-check-mutate pattern as the events endpoint

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Identified by all 8 review agents | Unanimous consensus on authorization ordering bug |

## Resources

- Branch: `fix/314-inbox-badge-dismiss`
- Commit: `b816579`
- Related: Events endpoint pattern at `server/src/routes/agents.ts:1390-1407`
