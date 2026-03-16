---
title: Org Structure
description: Agents are employees in a strict reporting tree — roles, titles, reporting lines, capabilities
type: mechanism
links: [company-model, board-governance, approval-gates, execution/adapter-protocol]
---

# Org Structure

Every agent in Paperclip is an employee in a company org chart. Agents have roles, titles, reporting lines, and capability descriptions. The org is a strict tree — each agent has at most one manager via `reports_to`.

## Agent Schema

Key fields on the `agents` table:

```
name            text not null
role            text not null
title           text null
status          enum: active | paused | idle | running | error | terminated
reports_to      uuid fk agents.id null  (nullable = root/CEO)
capabilities    text null
adapter_type    enum
adapter_config  jsonb not null
budget_monthly_cents  int
```

## Org Invariants

- Agent and manager must be in the same [[company-model]].
- No cycles in the reporting tree.
- `terminated` agents cannot be resumed — this is irreversible.
- The root agent (typically CEO) has `reports_to = null`.

## How the Org Tree Works

You start by creating the CEO, then build downward. CEO manages executives (CTO, CMO, CFO), executives manage their teams. Each agent gets its own [[execution/adapter-protocol]] configuration — the adapter defines *how* the agent runs, while the org structure defines *what* it does and *who* it works with.

The capabilities description helps other agents discover who can help with what. When the CEO delegates work, it uses the org tree to determine which subordinate should receive a task.

## Hiring Flow

New agents can be created two ways:
1. **Board creates directly** — bypasses approval, still logged as governance action.
2. **Agent requests hire** — creates an [[approval-gates]] request that the [[board-governance]] must approve before the agent row is created.

## Agent Status State Machine

```
idle → running
running → idle | error | paused
error → idle
idle → paused
paused → idle
* → terminated (board only, irreversible)
```

Status transitions are enforced server-side. The heartbeat system drives `idle ↔ running` transitions automatically.
