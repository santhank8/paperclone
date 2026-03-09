---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, caching]
dependencies: []
---

# Add In-Memory Channel Cache for Dispatch Path

## Problem Statement

Every mapped live event triggers a DB query (`SELECT * FROM notification_channels WHERE company_id = ? AND enabled = true`) even for companies with zero notification channels. The `notification_channels` table changes rarely (only via CRUD operations), making it an ideal caching candidate.

## Findings

**Source agents:** performance-oracle, architecture-strategist

**Evidence:**
- `server/src/services/notification.ts` lines 280-288 -- DB query per dispatch
- With 10 companies, 5 agents each: dozens of mappable events per minute, each hitting DB
- 78 `logActivity()` call sites each produce a live event that potentially maps to a dispatch query
- Index `(company_id, enabled)` makes queries efficient, but they're still unnecessary I/O

**Affected files:**
- `server/src/services/notification.ts`

## Proposed Solutions

### Option A: Map<companyId, {channels, expiresAt}> with 30s TTL (Recommended)
Simple in-memory cache. Invalidate on create/update/delete operations.

- **Pros:** Eliminates nearly all dispatch DB queries, simple implementation
- **Cons:** Single-instance only (fine for current architecture)
- **Effort:** Small-Medium (30-60 min)
- **Risk:** Low

## Acceptance Criteria

- [ ] Companies with no channels produce zero DB queries on dispatch
- [ ] Cache invalidated on create, update, and delete operations
- [ ] TTL prevents stale data (30-60 seconds)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Channel data changes rarely, perfect cache candidate |
