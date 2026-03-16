---
title: Cost & Budget System
description: Monthly budgets per agent, cost event ingestion, hard-stop auto-pause at 100% utilization
type: mechanism
links: [company-model, execution/heartbeat-system, board-governance, activity-log]
---

# Cost & Budget System

Paperclip tracks token spend and enforces budgets to prevent runaway costs. Every model invocation generates a cost event, and budgets operate at multiple layers.

## Budget Layers

1. **Company monthly budget** — overall spending cap
2. **Agent monthly budget** — per-agent spending cap (`budget_monthly_cents`)
3. **Project budget** — optional, if configured

Budget period is monthly UTC calendar window.

## Enforcement Rules

- **Soft alert** at 80% utilization — warning event
- **Hard limit** at 100% — triggers:
  - Agent status set to `paused`
  - New checkout/invocation blocked for that agent
  - High-priority activity event emitted
  - [[execution/heartbeat-system]] stops scheduling wakeups

The [[board-governance]] can override by raising the budget or explicitly resuming the agent. Task checkout and budget enforcement are atomic — no double-work and no surprise bills.

## Cost Event Ingestion

```
POST /companies/:companyId/cost-events
{
  "agentId": "uuid",
  "issueId": "uuid",
  "provider": "anthropic",
  "model": "claude-opus-4-6",
  "inputTokens": 1234,
  "outputTokens": 567,
  "costCents": 89,
  "occurredAt": "2026-03-13T20:00:00Z",
  "billingCode": "optional"
}
```

Validation: non-negative token counts, `costCents >= 0`, [[company-model]] ownership checks for all linked entities.

## Rollups

Read-time aggregate queries for V1:
- `GET /companies/:companyId/costs/summary` — month-to-date totals
- `GET /companies/:companyId/costs/by-agent` — per-agent breakdown
- `GET /companies/:companyId/costs/by-project` — per-project breakdown

The dashboard shows spend/budget utilization in real time. Materialized rollups deferred to post-V1 if query latency becomes an issue.

## Runtime State Tracking

The `agent_runtime_state` table accumulates lifetime counters: `total_input_tokens`, `total_output_tokens`, `total_cost_cents`. Per-run usage is stored in `heartbeat_runs.usage_json`. Both feed the [[activity-log]] for audit.
