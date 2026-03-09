---
status: wontfix
priority: p2
issue_id: 009
tags: [code-review, deployment, migration]
dependencies: []
---

## Problem Statement
New server code reads/writes `heartbeat_runs.dismissed_at`. If application code is deployed before migration `0026`, endpoints can fail with missing-column errors.

## Findings
- Migration adds column: `packages/db/src/migrations/0026_goofy_james_howlett.sql:1`.
- New query filter depends on column: `server/src/services/sidebar-badges.ts:37`.
- New write depends on column: `server/src/services/heartbeat.ts:2293`.

## Proposed Solutions
### Option A: Enforce migration-first rollout (recommended)
- **Approach:** Update deployment runbook/checklist: DB migration must complete before server rollout.
- **Pros:** Simple and reliable.
- **Cons:** Requires operator discipline.
- **Effort:** Small
- **Risk:** Low

### Option B: Temporary compatibility guard
- **Approach:** Feature-gate dismiss logic and filter until schema version check passes.
- **Pros:** More resilient during staggered deploys.
- **Cons:** Additional complexity for a small change.
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

## Technical Details
- Affected layers: DB migration + server routes/services + UI actions.
- No data backfill required; column is nullable.

## Acceptance Criteria
- [ ] Release checklist includes migration-first ordering.
- [ ] Post-deploy verification query confirms `dismissed_at` exists.
- [ ] On-call runbook includes rollback guidance (app rollback without dropping column).

## Work Log
- 2026-03-08: Added from data-migration and deployment-verification review findings.

## Resources
- Files: `packages/db/src/migrations/0026_goofy_james_howlett.sql`, `server/src/services/sidebar-badges.ts`, `server/src/services/heartbeat.ts`
