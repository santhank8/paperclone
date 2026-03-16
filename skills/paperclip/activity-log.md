---
title: Activity Log
description: Append-only audit trail — every mutation logged with actor, action, entity, and details
type: mechanism
links: [issue-lifecycle, execution/heartbeat-system, board-governance, realtime-events]
---

# Activity Log

Every mutating action in Paperclip is recorded in an append-only audit log. No edits, no deletions. Full accountability.

## Schema

```
activity_log table:
  actor_type   enum: agent | user | system
  actor_id     uuid/text not null
  action       text not null
  entity_type  text not null
  entity_id    uuid/text not null
  details      jsonb null
  created_at   timestamptz not null default now()
```

All entries are company-scoped via `company_id`.

## What Gets Logged

Every mutation path writes an activity entry:

- Agent creation, pause, resume, termination
- Task creation, status transitions, checkout, release
- Comment creation
- [[approval-gates]] requests and decisions
- [[cost-budget]] events and budget changes
- [[execution/heartbeat-system]] run starts, completions, failures, cancellations
- [[board-governance]] overrides and direct actions
- Wakeup requests, coalescing events
- Runtime state updates

## API Access

```
GET /companies/:companyId/activity
```

Returns a paginated, reverse-chronological stream. The dashboard's "Recent Activity" panel reads from this endpoint.

## Realtime Integration

Activity entries are pushed to browser clients via the [[realtime-events]] websocket channel as `activity.appended` events. This means the activity feed in the UI updates live without polling.

## Security Constraints

- Activity and approval payloads must not persist raw sensitive values
- Secrets are redacted in logged adapter configs
- The log is write-once — no endpoint exists to modify or delete entries

## Why Append-Only

When your workforce is autonomous AI agents, you need an immutable record of every decision. If something goes wrong, the activity log is the forensic trail. This is not optional — it's a core invariant of the control plane.
