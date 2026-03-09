---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, data-integrity, error-handling]
dependencies: []
---

# Unique Constraint Violation Returns 500 Instead of 409

## Problem Statement

The notification service performs a pre-check SELECT for name uniqueness before INSERT, but concurrent requests can both pass the check. The second INSERT hits PostgreSQL's unique constraint (error code 23505), which is not caught by the error handler, resulting in a 500 Internal Server Error instead of a 409 Conflict.

## Findings

**Source agents:** data-integrity-guardian

**Evidence:**
- `server/src/services/notification.ts` lines 173-183 (create) and 218-228 (update) -- pre-check SELECT
- DB unique index `notification_channels_company_name_idx` on `(company_id, name)` catches the race
- Error handler in `server/src/middleware/error-handler.ts` only handles `HttpError` and `ZodError`, not 23505
- Data integrity is preserved (DB prevents duplicates), but UX is broken (500 vs 409)

**Affected files:**
- `server/src/services/notification.ts` - `create` and `update` methods

## Proposed Solutions

### Option A: Catch 23505 in service layer (Recommended)
Wrap INSERT/UPDATE in try/catch, detect `code === "23505"`, throw `conflict()`.

- **Pros:** Simple, matches existing pattern in `companies.ts`
- **Cons:** Slightly more code
- **Effort:** Small (< 15 min)
- **Risk:** Low

## Acceptance Criteria

- [ ] Concurrent create with same name returns 409 (not 500)
- [ ] Concurrent update to conflicting name returns 409 (not 500)
- [ ] Error message matches the existing pre-check message

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | DB protects data, error handling is the gap |
