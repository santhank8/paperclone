---
status: done
priority: p1
issue_id: 006
tags: [code-review, security, authorization, multi-tenant]
dependencies: []
---

## Problem Statement
`POST /api/heartbeat-runs/:runId/dismiss` mutates run state before company authorization is enforced. This can allow unauthorized cross-company state changes if a run ID is known.

## Findings
- `server/src/routes/agents.ts:1372` calls `heartbeat.dismissRun(runId)` before `assertCompanyAccess(req, run.companyId)` at `server/src/routes/agents.ts:1377`.
- `server/src/services/heartbeat.ts:2294` updates by `id` only and does not include `companyId` in the `WHERE` clause.
- Multiple reviewers (security-sentinel, architecture-strategist, typescript reviewer, pattern reviewer, simplicity reviewer) identified this as a merge-blocking issue.

## Proposed Solutions
### Option A: Authorize before mutate (recommended)
- **Approach:** Fetch run first, call `assertCompanyAccess`, then call dismiss mutation.
- **Pros:** Minimal code change, fixes immediate vulnerability.
- **Cons:** Still relies on caller discipline for tenant scoping.
- **Effort:** Small
- **Risk:** Low

### Option B: Make service mutation company-scoped
- **Approach:** Change service signature to `dismissRun(companyId, runId)` and update query to `WHERE id = ? AND company_id = ?`.
- **Pros:** Encodes tenant boundary in service contract; safer for future callers.
- **Cons:** Slightly larger refactor touching route and call sites.
- **Effort:** Medium
- **Risk:** Low

### Option C: Combine A + B
- **Approach:** Authorize in route and enforce company in service query.
- **Pros:** Defense in depth, strongest guarantee.
- **Cons:** More changes than A alone.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

## Technical Details
- Affected endpoint: `POST /api/heartbeat-runs/:runId/dismiss`
- Affected service: `heartbeatService.dismissRun`
- Data impact: `heartbeat_runs.dismissed_at` may be set on unauthorized tenant records.

## Acceptance Criteria
- [ ] Dismiss endpoint checks company access before any DB write.
- [ ] Service-level dismiss query is tenant-scoped by `company_id`.
- [ ] Cross-company dismiss attempt returns 403 and does not change `dismissed_at`.
- [ ] Add/adjust test that proves no mutation occurs on unauthorized request.

## Work Log
- 2026-03-08: Created from multi-agent review synthesis of branch `fix/314-inbox-badge-dismiss`.

## Resources
- Branch: `fix/314-inbox-badge-dismiss`
- Files: `server/src/routes/agents.ts`, `server/src/services/heartbeat.ts`
