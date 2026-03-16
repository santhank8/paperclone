---
title: Realtime Events
description: WebSocket push for live UI updates — agent status, run progress, task changes, activity stream
type: mechanism
links: [execution/heartbeat-system, issue-lifecycle, activity-log]
---

# Realtime Events

Paperclip pushes runtime and activity updates to the browser in real time via WebSocket. No polling required for status changes.

## Transport

```
GET /api/companies/:companyId/events/ws
```

Auth: board session or agent API key (company-bound). One channel per company. Selective subscription by company scope.

## Event Envelope

```json
{
  "eventId": "uuid-or-monotonic-id",
  "companyId": "uuid",
  "type": "heartbeat.run.status",
  "entityType": "heartbeat_run",
  "entityId": "uuid",
  "occurredAt": "2026-03-13T12:00:00Z",
  "payload": {}
}
```

## Event Types

| Event | Source |
|---|---|
| `agent.status.changed` | [[execution/heartbeat-system]] run lifecycle |
| `heartbeat.run.queued` | Wakeup coordinator enqueue |
| `heartbeat.run.started` | Run executor claims wakeup |
| `heartbeat.run.status` | Adapter status hook (color + message) |
| `heartbeat.run.log` | Optional live chunk stream |
| `heartbeat.run.finished` | Run completion/failure |
| `issue.updated` | [[issue-lifecycle]] status/assignment changes |
| `issue.comment.created` | Agent or board comment |
| `activity.appended` | [[activity-log]] new entry |

## UI Behavior

- Agent detail view updates run timeline live
- Task board reflects assignment/status/comment changes without refresh
- Org chart and agent list show status changes live
- Dashboard panels (costs, activity, approvals) update in real time

If WebSocket disconnects, the client falls back to short polling until reconnect. Reconnection is automatic.

## Throttling

Live log streaming (`heartbeat.run.log`) may be throttled/chunked to avoid overwhelming the browser. Full logs are persisted separately via the RunLogStore and retrievable after the run completes.
