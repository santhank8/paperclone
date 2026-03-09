---
status: wontfix
priority: p2
issue_id: 008
tags: [code-review, performance, database]
dependencies: []
---

## Problem Statement
Sidebar badge calculation now filters on `dismissed_at IS NULL` with `DISTINCT ON (agent_id)` ordered by latest run, but no supporting index is present for the new access pattern.

## Findings
- Query: `server/src/services/sidebar-badges.ts:27-40` uses `selectDistinctOn([agentId])` and `orderBy(agentId, createdAt desc)` with `isNull(dismissedAt)`.
- Existing index in schema (`heartbeat_runs_company_agent_started_idx`) is on `(company_id, agent_id, started_at)` and does not align with `created_at` + `dismissed_at` filter.
- Badge endpoints are polled frequently, so this query is on a hot path.

## Proposed Solutions
### Option A: Add partial composite index (recommended)
- **Approach:** Add index on `(company_id, agent_id, created_at DESC)` where `dismissed_at IS NULL`.
- **Pros:** Aligns directly with query and reduces scan/sort cost.
- **Cons:** Adds index storage and write overhead.
- **Effort:** Medium
- **Risk:** Low

### Option B: Rewrite query with aggregation
- **Approach:** Use grouped subquery to get latest run per agent, then join/filter.
- **Pros:** May be easier for planner in some datasets.
- **Cons:** More query complexity; still likely needs index tuning.
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

## Technical Details
- Affected files: `server/src/services/sidebar-badges.ts`, `packages/db/src/schema/heartbeat_runs.ts`
- Migration likely required to add index.

## Acceptance Criteria
- [ ] New index added and migrated safely.
- [ ] Query plan for sidebar badges uses index scan/bitmap efficiently.
- [ ] Sidebar badge p95 latency remains stable under production-like data volume.

## Work Log
- 2026-03-08: Added from performance-oracle findings.

## Resources
- Files: `server/src/services/sidebar-badges.ts`, `packages/db/src/schema/heartbeat_runs.ts`
