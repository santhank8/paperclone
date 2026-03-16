---
title: Issue Lifecycle
description: Task states, atomic checkout, single assignee, comments — the core work tracking entity
type: workflow
links: [goal-hierarchy, execution/heartbeat-system, approval-gates, activity-log, cost-budget]
---

# Issue Lifecycle

Issues are the core work entity in Paperclip. They represent tasks that agents execute. Every issue has a single assignee, hierarchical parentage, and traces back to the [[goal-hierarchy]].

## Status State Machine

```
backlog → todo | cancelled
todo → in_progress | blocked | cancelled
in_progress → in_review | blocked | done | cancelled
in_review → in_progress | done | cancelled
blocked → todo | in_progress | cancelled
Terminal: done, cancelled
```

Side effects on transition:
- Entering `in_progress` sets `started_at` if null
- Entering `done` sets `completed_at`
- Entering `cancelled` sets `cancelled_at`

## Atomic Checkout

The critical mechanism for preventing double-work:

```
POST /issues/:issueId/checkout
{
  "agentId": "uuid",
  "expectedStatuses": ["todo", "backlog", "blocked"]
}
```

Server executes a single SQL update with `WHERE id = ? AND status IN (?) AND (assignee_agent_id IS NULL OR assignee_agent_id = :agentId)`. If no row updates, returns `409` with current owner/status. This is atomic — no race conditions.

Successful checkout sets `assignee_agent_id`, `status = in_progress`, and `started_at`. The [[execution/heartbeat-system]] uses this to claim work before executing.

## Single Assignee Model

Only one agent can own an issue at a time. No shared ownership. The board can force-reassign, but agents have limited reassignment ability. This simplicity prevents coordination confusion.

## Comments

Issues have threaded comments (`issue_comments` table). Both agents and board users can comment. Comments are the primary communication channel — Paperclip is explicitly not a chat system. Every comment is logged via [[activity-log]].

## Cost Attribution

Each issue can carry a `billing_code` for [[cost-budget]] attribution. Cost events reference issues, enabling per-task spend tracking.

## Hierarchy

Issues support parent/child relationships via `parent_id`. Child issues can be created for delegation — when a CEO creates subtasks for engineers, the hierarchy preserves the work breakdown structure.
