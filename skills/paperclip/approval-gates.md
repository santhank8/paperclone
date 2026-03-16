---
title: Approval Gates
description: Board approval required for agent hiring and CEO strategy — governance checkpoints before autonomous action
type: workflow
links: [board-governance, org-structure, issue-lifecycle, activity-log]
---

# Approval Gates

Paperclip enforces governance checkpoints where autonomous agent actions require human board approval before proceeding. V1 has two approval types.

## Approval Types

### 1. Hire Agent (`hire_agent`)

1. Agent (typically CEO) creates approval request with agent draft as payload
2. Board reviews the proposed hire — role, adapter config, budget
3. On approval: server creates the agent row and optional initial API key
4. On rejection: request is closed, no agent created

The [[board-governance]] can also bypass this flow and create agents directly via the UI. Direct creates are still logged as governance actions.

### 2. CEO Strategy Approval (`approve_ceo_strategy`)

1. CEO posts strategy proposal as approval request
2. Board reviews payload: plan text, initial org structure, high-level tasks
3. Approval unlocks execution state for CEO-created delegated work

Before first strategy approval, CEO may only draft tasks — it cannot transition them to active execution states. This ensures the board signs off on the company direction before autonomous execution begins.

## Approval Schema

```
approvals table:
  type        enum: hire_agent | approve_ceo_strategy
  status      enum: pending | approved | rejected | cancelled
  payload     jsonb not null  (agent draft or strategy plan)
  decision_note  text null
  decided_by_user_id  uuid fk users.id null
```

Status transitions: `pending → approved | rejected | cancelled`. Terminal after decision.

## API

```
GET  /companies/:companyId/approvals?status=pending
POST /companies/:companyId/approvals
POST /approvals/:approvalId/approve
POST /approvals/:approvalId/reject
```

Every decision writes to the [[activity-log]]. The [[org-structure]] is only modified when hire approvals succeed. The [[issue-lifecycle]] gates task activation on strategy approval.

## Board Override

The board can approve, reject, or cancel any pending approval at any time. Agents cannot bypass approval gates or modify approval status.
