---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, pattern-consistency, api]
dependencies: []
---

# DELETE Returns 204 Instead of json({ ok: true })

## Problem Statement

The notification channel DELETE endpoint returns `res.status(204).end()`, making it the only route in the entire codebase using 204 No Content. Every other DELETE endpoint returns `res.json({ ok: true })`. This inconsistency could break frontend code expecting a JSON body.

## Findings

**Source agents:** pattern-recognition-specialist

**Evidence:**
- `server/src/routes/notification-channels.ts` line 114: `res.status(204).end()`
- `server/src/routes/secrets.ts` line 161: `res.json({ ok: true })`
- `server/src/routes/agents.ts` line 1112: `res.json({ ok: true })`
- `server/src/routes/companies.ts` line 178: `res.json({ ok: true })`
- `server/src/routes/issues.ts` lines 413, 1185: `res.json({ ok: true })`

**Affected files:**
- `server/src/routes/notification-channels.ts` line 114

## Proposed Solutions

### Option A: Change to res.json({ ok: true }) (Recommended)
Match the codebase convention.

- **Effort:** Small (1 line change)
- **Risk:** None

## Acceptance Criteria

- [ ] DELETE endpoint returns `res.json({ ok: true })` matching all other routes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Only 204 in entire codebase |
