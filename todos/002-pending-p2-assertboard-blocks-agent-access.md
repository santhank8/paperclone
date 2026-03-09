---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, agent-native, access-control]
dependencies: []
---

# assertBoard Blocks All Agent Access to Notification Channels

## Problem Statement

All 7 notification channel endpoints use `assertBoard(req)`, which categorically blocks agent API key access with `403 "Board access required"`. Agents cannot list, create, read, update, delete, or test notification channels. Additionally, the activity logging hardcodes `actorType: "user"` and `actorId: req.actor.userId ?? "board"`, which will produce misleading audit entries when agents gain access.

## Findings

**Source agents:** agent-native-reviewer

**Evidence:**
- `server/src/routes/notification-channels.ts` lines 18, 30, 55, 65, 76, 98, 119 -- all have `assertBoard(req)`
- Lines 38, 84, 106 -- activity log hardcodes `actorType: "user"`
- The codebase already supports mixed access via `assertCompanyAccess()` and `getActorInfo()` in `routes/authz.ts`
- Issues, approvals, and agent routes already use the mixed-access pattern

**Affected files:**
- `server/src/routes/notification-channels.ts`

## Proposed Solutions

### Option A: Replace assertBoard with assertCompanyAccess (Recommended)
Use `assertCompanyAccess(req, companyId)` for company-scoped endpoints. For ID-scoped endpoints, fetch then `assertCompanyAccess(req, channel.companyId)`. Use `getActorInfo(req)` for activity logging.

- **Pros:** Matches existing patterns, enables agent access immediately
- **Cons:** No fine-grained permission control
- **Effort:** Small (< 30 min)
- **Risk:** Low

### Option B: Add a notifications:manage permission
Create a new permission key and gate notification channel management behind it.

- **Pros:** Fine-grained control over which agents can manage channels
- **Cons:** More complex, requires permission schema update
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

## Acceptance Criteria

- [ ] Agents with valid API keys can access notification channel endpoints
- [ ] Activity log correctly records agent actor type and ID
- [ ] Board users retain full access

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | 0/7 endpoints agent-accessible |

## Resources

- PR #389: feat(notifications): add notification channels backend
- `server/src/routes/authz.ts` for `assertCompanyAccess` and `getActorInfo` patterns
