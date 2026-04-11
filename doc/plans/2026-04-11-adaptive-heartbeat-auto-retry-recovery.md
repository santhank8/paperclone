# Adaptive Heartbeat Auto-Retry and Recovery Plan

## Context

Today a failed run commonly surfaces in Inbox with a manual `Retry` action. Paperclip already has two narrow automatic recovery paths:

- one automatic retry for `process_lost` orphan recovery (`process_loss_retry_count`)
- one automatic follow-up wake when issue-comment policy is violated (`issue_comment_status` flow)

This plan generalizes recovery so transient failures retry automatically, while non-retriable failures still escalate to Inbox with clear context.

## Goals

1. Auto-retry transient run failures without operator intervention.
2. Escalate to Inbox only when recovery is exhausted or blocked.
3. Prevent retry storms via circuit breaker + retry budgets.
4. Preserve control-plane invariants (company scope, budget hard stops, pause gates, activity logs).
5. Keep manual `Retry now` as an explicit override.

## Non-Goals

- automatic task reassignment
- auto-approval bypass
- replacing issue execution lock semantics
- introducing external queue infra (still use in-process scheduler/worker)

## Policy Defaults

### Failure classes

- `transient`: timeouts, process loss, provider/network temporary failures
- `auth`: missing/expired auth
- `config`: invalid adapter/project/runtime config
- `policy`: budget/pause/approval gating
- `unknown`: uncategorized failure

### Retry schedule

- Fast lane: attempt 1 `+5s`, attempt 2 `+20s`, attempt 3 `+60s`
- Deferred lane: attempt 4 `+5m`, attempt 5 `+20m`, attempt 6 `+60m`
- Jitter: `+-20%` per delay
- Max attempts: `6`
- Max wall time per retry chain: `2h`
- Max additional billed cost per chain: `200` cents (configurable)

### Circuit breaker (company + adapter)

- Open when, inside a rolling 2-minute window:
- at least `5` classified transient failures
- transient failure ratio `>= 80%`
- Open duration starts at `10m`, doubles on repeated opens, cap `60m`
- Half-open probe allows a single retry candidate
- Success in half-open closes circuit and resets counters

## State Model

### Run status (existing)

- `queued`, `running`, `succeeded`, `failed`, `cancelled`, `timed_out`

### New retry state (`heartbeat_runs.retry_state`)

- `none`: run not in retry flow
- `scheduled`: retry already queued for future execution
- `retrying`: run is an auto-retry attempt currently running
- `recovered`: chain had prior failure and latest attempt succeeded
- `exhausted`: retriable, but limits reached
- `blocked`: retriable but blocked by gate/circuit/policy
- `non_retriable`: classified as auth/config/policy/terminal

### Transitions

- `failed|timed_out -> scheduled` when auto-retry is queued
- `scheduled -> retrying` when queued retry is claimed to running
- `retrying -> recovered` when a retry attempt succeeds
- `failed|timed_out -> exhausted|blocked|non_retriable` when retry is not queued

## Data Model Changes

### 1) `heartbeat_runs` (extend)

Add columns:

- `retry_group_id uuid null` FK `heartbeat_runs.id` (`on delete set null`)
- `retry_attempt integer not null default 0`
- `retry_state text not null default 'none'`
- `retry_class text null`
- `retry_scheduled_for timestamptz null`
- `retry_exhausted_at timestamptz null`
- `retry_blocked_reason text null`
- `retry_last_decision text null`
- `retry_policy_json jsonb null`

Indexes:

- `heartbeat_runs_retry_group_attempt_idx` unique on `(retry_group_id, retry_attempt)` where `retry_group_id is not null`
- `heartbeat_runs_retry_due_idx` on `(agent_id, status, retry_scheduled_for, created_at)`

Notes:

- existing `retry_of_run_id` remains the direct parent link
- `retry_group_id` points to the chain root run id

### 2) `agent_wakeup_requests` (extend)

Add columns:

- `scheduled_for timestamptz null`
- `retry_group_id uuid null` FK `heartbeat_runs.id` (`on delete set null`)
- `retry_attempt integer null`

Index:

- `agent_wakeup_requests_company_status_scheduled_idx` on `(company_id, status, scheduled_for)`

### 3) New table: `heartbeat_retry_circuits`

Columns:

- `id uuid pk default random`
- `company_id uuid not null` FK `companies.id`
- `adapter_type text not null`
- `state text not null default 'closed'` (`closed|open|half_open`)
- `opened_at timestamptz null`
- `open_until timestamptz null`
- `next_probe_at timestamptz null`
- `window_started_at timestamptz not null default now()`
- `window_total integer not null default 0`
- `window_failures integer not null default 0`
- `consecutive_failures integer not null default 0`
- `cooldown_seconds integer not null default 600`
- `last_failure_code text null`
- `last_failure_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraint:

- unique `(company_id, adapter_type)`

## Shared Contracts

Update shared constants/types:

- add `HEARTBEAT_RETRY_STATES`
- extend `HeartbeatRun` with all retry columns above
- extend `AgentWakeupRequest` with `scheduledFor`, `retryGroupId`, `retryAttempt`

No new public endpoint is required for initial rollout; existing run listing can carry these fields.

## Server Flow

## 1) Failure classification

Add `classifyRunFailure(run, adapterResult)` in `server/src/services/heartbeat.ts`:

Classification priority:

1. `policy` for budget/pause/approval/circuit blocks
2. `auth` for `*_auth_required` and auth-required signatures
3. `config` for invalid URL/config/schema/required fields
4. `transient` for timeout/process_lost/network/provider-transient signatures
5. `unknown`

Retry eligibility:

- `transient`: eligible
- `unknown`: eligible up to fast lane only (attempt <= 3)
- `auth|config|policy`: not eligible

## 2) Retry planning

Add `planAutomaticRetry(input)` in `heartbeat.ts`, invoked after run finalization when status is `failed` or `timed_out`.

Algorithm:

1. Resolve root chain id (`retry_group_id` else current run id).
2. Determine next attempt (`retry_attempt + 1`).
3. Enforce gates in order:
- company active
- agent invokable
- budget invocation block absent
- issue execution gating (existing)
- circuit allows attempt
4. Enforce budgets:
- attempt cap
- elapsed cap
- chain cost cap
5. If blocked/exhausted/non-retriable:
- update current run retry fields
- append run event
- emit activity log
- stop
6. If allowed:
- compute delay with jitter
- insert wakeup request (`source=automation`, `trigger_detail=system`, reason `auto_retry`)
- insert retry run immediately as `status='queued'` with `retry_scheduled_for=dueTime`
- set `retry_state='scheduled'` on failed run
- emit `heartbeat.run.queued` live event

## 3) Claiming queued runs

In `startNextQueuedRunForAgent` and related live-run counters:

- treat queued runs with `retry_scheduled_for > now()` as not yet claimable
- they should not count toward live-run limit
- ordering for claimable runs:
- `coalesce(retry_scheduled_for, created_at)` then `created_at`

## 4) Scheduler integration

Reuse existing scheduler loop in `server/src/index.ts`:

- periodic `resumeQueuedRuns()` should now naturally pick due auto-retries
- no separate queue worker required

## 5) Circuit breaker updates

On every finalized run:

- update circuit row for `(company_id, adapter_type)`
- transient failure increments rolling counters
- success decrements/resets and may close half-open/open circuit
- opening circuit marks subsequent retry candidates as `blocked`

## 6) Activity and run events

Emit events/actions:

- `heartbeat.retry_scheduled`
- `heartbeat.retry_recovered`
- `heartbeat.retry_exhausted`
- `heartbeat.retry_blocked`
- `heartbeat.circuit_opened`
- `heartbeat.circuit_closed`

All activity rows stay company-scoped.

## UI/Inbox Behavior

### Inbox failed-run surfacing

Update inbox failed-run selection logic to show items only when latest failed/timed_out run is terminal from a recovery perspective:

- show when `retry_state in ('exhausted','blocked','non_retriable')`
- hide while `retry_state in ('scheduled','retrying')`

### Failed run row

Show retry metadata line:

- attempt count (`attempt N / 6`)
- final reason (`non-retriable auth`, `budget blocked`, `circuit open`, `retry exhausted`)

### Manual override

Keep current button but label `Retry now`.

Manual retry behavior:

- bypass circuit-open gate
- still enforce company pause and budget hard stop
- mark new run `retry_last_decision='manual_retry'`

## File-Level Implementation Plan

### Database and shared contracts

- `packages/db/src/schema/heartbeat_runs.ts`
- `packages/db/src/schema/agent_wakeup_requests.ts`
- `packages/db/src/schema/heartbeat_retry_circuits.ts` (new)
- `packages/db/src/schema/index.ts`
- `packages/db/src/migrations/*` (generated)
- `packages/shared/src/constants.ts`
- `packages/shared/src/types/heartbeat.ts`

### Server

- `server/src/services/heartbeat.ts`
- `server/src/services/sidebar-badges.ts` (failed-run counting semantics)
- `server/src/routes/agents.ts` (manual retry payload/context annotations)

### UI

- `ui/src/lib/inbox.ts`
- `ui/src/pages/Inbox.tsx`
- `ui/src/pages/AgentDetail.tsx` (retry copy + retry metadata)

### Tests

- `server/src/__tests__/heartbeat-process-recovery.test.ts` (extend)
- new: `server/src/__tests__/heartbeat-auto-retry-policy.test.ts`
- new: `server/src/__tests__/heartbeat-circuit-breaker.test.ts`
- `ui/src/lib/inbox.test.ts`
- `ui/src/pages/Inbox.test.tsx`

## Verification

Run before handoff:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

Targeted checks:

1. transient failure auto-retries without inbox escalation until exhausted
2. auth/config failures skip auto-retry and immediately surface
3. circuit opens under burst failures and suppresses auto-retry scheduling
4. half-open probe closes circuit on success
5. manual `Retry now` works during circuit-open but still respects budget hard-stop
6. company pause prevents scheduling and marks run `blocked`

## Rollout

Feature flags (server env):

- `HEARTBEAT_AUTO_RETRY_ENABLED=false` (default off)
- `HEARTBEAT_AUTO_RETRY_MAX_ATTEMPTS=6`
- `HEARTBEAT_AUTO_RETRY_FAST_SCHEDULE=5,20,60`
- `HEARTBEAT_AUTO_RETRY_DEFERRED_SCHEDULE=300,1200,3600`
- `HEARTBEAT_AUTO_RETRY_CHAIN_MAX_COST_CENTS=200`

Rollout steps:

1. ship schema + code paths behind flag
2. enable in dev worktrees
3. enable in staging with telemetry dashboard
4. enable by default after 1 week of stable metrics

## Acceptance Criteria

1. A transient run failure retries automatically per schedule without user action.
2. Inbox shows run failures only when recovery is exhausted, blocked, or non-retriable.
3. No retry storm occurs under provider outages (circuit breaker opens and cools down).
4. Retry chains stop on budget hard-stop, company pause, or limit exhaustion.
5. Every retry decision is visible in run events and activity log.
