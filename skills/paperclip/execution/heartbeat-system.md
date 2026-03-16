---
title: Heartbeat System
description: Wakeup coordinator, timer/assignment/on-demand triggers, queue semantics, run lifecycle — the core execution loop
type: mechanism
links: [adapter-protocol, session-resume, ../issue-lifecycle, ../cost-budget, ../realtime-events]
---

# Heartbeat System

Agents in Paperclip do not run continuously. They run in **heartbeats**: short execution windows triggered by a wakeup. The heartbeat system is the core execution loop — it decides when agents wake, ensures only one run at a time, and manages the full run lifecycle.

## Wakeup Sources

Four ways to wake an agent:

| Source | Trigger |
|---|---|
| `timer` | Scheduled interval (e.g., every 300s) |
| `assignment` | Issue assigned/checked out to agent |
| `on_demand` | Manual button click or API ping |
| `automation` | System callback or internal automation |

All sources call one internal service — no source invokes adapters directly:

```ts
enqueueWakeup({
  companyId, agentId, source,
  triggerDetail,  // manual|ping|callback|system
  reason, payload, requestedBy,
  idempotencyKey?
})
```

## Queue Semantics

- Max 1 active run per agent (V1)
- If agent already has a `queued` or `running` run, new wakeups are **coalesced** (merged, not duplicated)
- Queue is DB-backed for restart safety (`agent_wakeup_requests` table)
- Priority: `on_demand` > `assignment` > `timer`/`automation`

## Run Lifecycle

1. Trigger arrives → wakeup coordinator enqueues
2. Executor claims request, creates `heartbeat_runs` row, marks agent `running`
3. [[adapter-protocol]] executes, emits status/log/usage events
4. Process exits → output parser updates run result + [[session-resume]] state
5. Agent returns to `idle` or `error`; UI updates via [[../realtime-events]]

## Scheduler Rules

Per-agent heartbeat policy:

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSec": 300,
    "wakeOnAssignment": true,
    "wakeOnOnDemand": true,
    "wakeOnAutomation": true,
    "cooldownSec": 10
  }
}
```

Scheduler skips invocation when: agent is paused/terminated, an existing run is active, or hard budget limit has been hit (see [[../cost-budget]]).

## Heartbeat Run Schema

Key fields on `heartbeat_runs`:

```
invocation_source   enum: scheduler | manual | callback
status              enum: queued | running | succeeded | failed | cancelled | timed_out
exit_code           int null
usage_json          jsonb null
session_id_before   text null
session_id_after    text null
log_ref             text null (opaque pointer to full logs)
```

## Common Operating Patterns

- **Autonomous loop**: timer every 300s + assignment wakeups + focused prompt
- **Event-driven**: no timer, wake-on-assignment only, on-demand for manual nudges
- **Safety-first**: short timeout, conservative prompt, quick cancel on errors
