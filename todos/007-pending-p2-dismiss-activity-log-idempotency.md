---
status: wontfix
priority: p2
issue_id: 007
tags: [code-review, quality, observability, audit]
dependencies: [006]
---

## Problem Statement
Repeated dismiss requests can create duplicate `heartbeat.dismissed` activity entries even when no state change occurs.

## Findings
- `server/src/services/heartbeat.ts:2289` returns existing run unchanged when `dismissedAt` is already set.
- `server/src/routes/agents.ts:1378` logs `heartbeat.dismissed` unconditionally after calling dismiss.
- This weakens audit accuracy and inflates activity stream noise.

## Proposed Solutions
### Option A: Return mutation metadata from service (recommended)
- **Approach:** Return `{ run, changed }` from `dismissRun` and log only when `changed` is `true`.
- **Pros:** Clear intent, preserves idempotency semantics.
- **Cons:** Small API change to service contract.
- **Effort:** Small
- **Risk:** Low

### Option B: Compare old/new timestamps in route
- **Approach:** Route checks `dismissedAt` before call and decides whether to log.
- **Pros:** Minimal service change.
- **Cons:** Duplicates state logic in route; easier to drift.
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

## Technical Details
- Affected files: `server/src/services/heartbeat.ts`, `server/src/routes/agents.ts`
- Scope: audit/event correctness, not data corruption.

## Acceptance Criteria
- [ ] Idempotent dismiss request does not emit duplicate `heartbeat.dismissed` log event.
- [ ] First successful dismiss still emits exactly one activity entry.
- [ ] Automated test covers repeated dismiss calls.

## Work Log
- 2026-03-08: Added from architecture/simplicity review findings.

## Resources
- Files: `server/src/services/heartbeat.ts`, `server/src/routes/agents.ts`
