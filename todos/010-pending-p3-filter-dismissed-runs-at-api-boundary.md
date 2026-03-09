---
status: wontfix
priority: p3
issue_id: 010
tags: [code-review, performance, api, quality]
dependencies: []
---

## Problem Statement
Dismissed runs are filtered in the inbox UI but still returned by heartbeat list APIs, causing unnecessary payload and potential context mismatch between UI expectations and downstream consumers.

## Findings
- API list currently returns all company runs unless `limit` is passed: `server/src/services/heartbeat.ts:2076-2090`.
- Inbox now filters dismissed runs client-side in `ui/src/pages/Inbox.tsx:115-130`.
- This keeps dismissed historical data in frequent responses where it is not used.

## Proposed Solutions
### Option A: Add `includeDismissed` query param (recommended)
- **Approach:** Extend heartbeat list endpoint/service with `includeDismissed` (default true for compatibility), then set false for inbox usage.
- **Pros:** Backward compatible, explicit semantics.
- **Cons:** Slight API surface increase.
- **Effort:** Small
- **Risk:** Low

### Option B: Add dedicated failed-runs endpoint
- **Approach:** Create focused endpoint returning only latest unresolved failures per agent.
- **Pros:** Optimized payload and query for inbox use case.
- **Cons:** More endpoint complexity.
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

## Technical Details
- Affected files: `server/src/routes/agents.ts`, `server/src/services/heartbeat.ts`, `ui/src/api/heartbeats.ts`, `ui/src/pages/Inbox.tsx`

## Acceptance Criteria
- [ ] Inbox request can exclude dismissed runs server-side.
- [ ] Existing clients remain compatible.
- [ ] Measured heartbeat payload size for inbox path decreases after change.

## Work Log
- 2026-03-08: Added from performance + agent-native review synthesis.

## Resources
- Files: `server/src/services/heartbeat.ts`, `ui/src/pages/Inbox.tsx`
