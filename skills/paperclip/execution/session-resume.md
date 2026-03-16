---
title: Session Resume
description: Per-task session persistence — agents resume the same context across heartbeats instead of restarting from scratch
type: mechanism
links: [heartbeat-system, claude-local-adapter, adapter-protocol]
---

# Session Resume

Paperclip stores resumable session state per `(agent, taskKey, adapterType)`. This means agents pick up where they left off instead of losing context between heartbeats.

## How It Works

1. On first heartbeat for a task, the adapter runs fresh (no session ID)
2. The [[claude-local-adapter]] extracts `session_id` from the JSON output
3. Paperclip stores the session ID in `agent_task_sessions`
4. On next heartbeat for the **same task**, the adapter adds `--resume <sessionId>`
5. Different task keys for the same agent keep separate session state

## Task Key Resolution

`taskKey` is derived from wakeup context, in priority order:
- Explicit `taskKey` from wakeup payload
- `taskId` or `issueId` from the assignment trigger
- Falls back to agent-level default

## Schema

```
agent_task_sessions table:
  agent_id              uuid fk
  adapter_type          text not null
  task_key              text not null
  session_params_json   jsonb null  (adapter-defined shape)
  session_display_id    text null   (for UI/debug)
  last_run_id           uuid fk heartbeat_runs.id
  last_error            text null

Unique: (company_id, agent_id, adapter_type, task_key)
```

## Aggregate Runtime State

The `agent_runtime_state` table keeps per-agent lifetime counters:
- `session_id` — current/latest session
- `total_input_tokens`, `total_output_tokens`, `total_cost_cents`
- `last_run_id`, `last_run_status`, `last_error`

This is updated after every run by the [[heartbeat-system]].

## When to Reset Sessions

Use session reset when:
- You significantly changed the prompt strategy
- The agent is stuck in a bad loop
- You want a clean restart for a specific task
- Session restore fails (adapters retry once with fresh session automatically)

API:
```
POST /agents/:agentId/runtime-state/reset-session
{ "taskKey": "optional-specific-task" }
```

Omit `taskKey` to clear all sessions for the agent.

## Failure Handling

If session restore fails, the [[adapter-protocol]] contract says adapters should retry once with a fresh session and continue. The failed restore is logged but doesn't block execution.
