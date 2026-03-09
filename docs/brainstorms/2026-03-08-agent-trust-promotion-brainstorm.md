# Agent Trust Promotion / Demotion System

**Date:** 2026-03-08
**Status:** Brainstorm complete, ready for planning
**Contribution target:** https://github.com/paperclipai/paperclip

## What We're Building

An automated trust progression system for Paperclip agents. Agents start as `supervised` (current behavior — all actions require board approval) and can earn `autonomous` status through a track record of successful heartbeat runs. Autonomous agents auto-approve `hire_agent` requests without board intervention. Trust can be revoked automatically if failure patterns emerge.

**This feature does not exist in Paperclip today.** Agents that succeed 50 times in a row have the same permissions as freshly created ones. No one in the ecosystem has proposed this.

**Alignment with project vision:** GOAL.md says Paperclip makes autonomous companies "more capable, more governable, more scalable." Trust promotion closes the gap between governance and autonomy — right now Paperclip has strong governance (approval gates) but no path to earned autonomy beyond the initial hire. This feature is the bridge.

## Why This Approach

- **2 trust levels** (`supervised` / `autonomous`) — not 3, not a numeric score. Binary is easier to reason about, easier to explain in the RFC, and covers the primary use case. Can always add levels later.
- **Gates approval requirements** — not just observability. Trust changes agent behavior by allowing autonomous agents to skip the `hire_agent` approval gate. `approve_ceo_strategy` always requires human sign-off regardless of trust.
- **Separate trust service** — not inline in heartbeat.ts. Keeps the already-large heartbeat service (2330 lines) clean. Follows the project's existing service-per-concern pattern (`agents.ts`, `approvals.ts`, `heartbeat.ts`).
- **Existing activity_log for audit** — not a new table. Reduces schema complexity. Trust transitions are logged as activity events alongside other agent lifecycle events.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trust levels | `supervised` (default) / `autonomous` | Simplest useful model. Binary decision: needs approval or doesn't. |
| Promotion trigger | 20 consecutive successful runs | Fixed default. Avoids config complexity. High enough to build real confidence. |
| Demotion trigger | 3 failures in rolling window of 10 runs | Tolerates isolated failures but catches patterns. Prevents trust ping-pong. |
| What trust gates | `hire_agent` approval auto-skip | Most frequent approval type. CEO strategy always needs human sign-off. |
| Audit trail | Existing `activity_log` | No new table. Trust events are agent lifecycle events. |
| Architecture | Dedicated `trust.ts` service | Called from `finalizeAgentStatus`. Clean separation. Easy to review. |
| Schema change | `trustLevel` column on `agents` table | Directly queryable. Default `'supervised'`. |
| Success definition | Only `succeeded` runs count | `cancelled` and `timed_out` are neutral — don't count toward promotion or demotion. Only `failed` counts against trust. |
| Manual override | Yes — operators can force promote/demote | PATCH endpoint + UI button. Logged to activity_log. Operators need an escape hatch. |
| Pause behavior | Trust preserved across pause/resume | Pausing is an operator choice, not a failure. Autonomous agents stay autonomous after pause/resume. |
| RFC scope | Full feature including UI | Trust badge on agent detail page + promotion progress in metadata. |
| Auto-skip mechanic | Auto-resolve approval at creation time | Approval record is created then immediately auto-approved with note. Preserves full audit trail. Existing `approve` logic handles agent activation. |
| Concurrency handling | WHERE clause guard (idempotent) | `UPDATE ... WHERE trustLevel = 'supervised'` prevents double-promotion from concurrent runs. No row locking needed. |

## Approval Auto-Skip Mechanics

When `POST /companies/:companyId/approvals` receives a `hire_agent` request:

1. Check if `requestedByAgentId` has `trustLevel = 'autonomous'`
2. If yes: create the approval record, then immediately call the existing `approve` flow with `decisionNote: "Auto-approved: autonomous trust level"` and `decidedByUserId: null` (system-initiated)
3. The existing `approve` logic in `approvals.ts:43-100` handles agent activation and hire hook notification — no new code needed for that path
4. If no: normal flow — approval sits in `pending` for board review

This means every hire still has an approval record in the database. Operators can see all auto-approvals in the approvals list. The audit trail is complete.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| **Concurrent runs completing** | WHERE clause guard on trust update. `UPDATE agents SET trustLevel = 'autonomous' WHERE id = ? AND trustLevel = 'supervised'`. Only one succeeds. Trust service is idempotent. |
| **Terminated agent** | `finalizeAgentStatus` already returns early for terminated agents (line 858). Trust evaluation never runs. Trust level on terminated agents is meaningless. |
| **New agent activation** | Agents start `pending_approval` → approved → `idle`. Trust starts as `supervised`. Counter begins at zero after activation. |
| **Agent in error status** | Trust evaluation still runs. Failed run counts toward demotion window. Agent's operational status (`error`) is independent of trust level. |
| **Demoted during active auto-approval** | Already-approved hires stand (valid at time of approval). Future hires go through normal board approval. |
| **Agent paused then resumed** | Trust level and consecutive success count preserved. Pausing is an operator choice, not a failure signal. |
| **Rolling window < 10 total runs** | If agent has fewer than 10 runs total, use actual run count as window. 3 failures in 5 runs still triggers demotion. |
| **Manual override then auto-evaluation** | Manual promotion/demotion resets the consecutive success counter. Prevents immediate re-demotion after manual promotion. |

## UI Design

**Trust badge**: Next to the existing status badge on agent detail page. Uses existing `StatusBadge` component pattern. Examples:
- `idle · supervised` (neutral color)
- `running · autonomous` (green/gold accent)

**Promotion progress**: Text in the metadata section alongside role, adapter, budget. Format: `"14/20 consecutive successes toward autonomous"` for supervised agents, or `"autonomous"` (no progress needed) for autonomous agents.

**Manual override**: Small button/dropdown near the trust badge. `"Promote to autonomous"` or `"Demote to supervised"`. Confirms before acting. Logs to activity_log.

## RFC Structure (following #219 format)

1. **Problem** — Agents have no path to earned autonomy. An agent that succeeds 50 times has the same permissions as day-one.
2. **Alternatives Considered** — Table comparing: (a) Manual-only promotion, (b) Continuous numeric score (0-100), (c) Status quo (no trust). Why 2-level automated system wins.
3. **Proposed Design** — Schema DDL, trust service API, approval integration, UI mockups.
4. **Files to Create/Change** — Explicit table.
5. **Edge Cases** — The table above.
6. **Out of Scope** — Per-company thresholds, additional trust levels, budget interaction, trust-gated permissions beyond approvals.

## Integration Points

| File | Change | Purpose |
|------|--------|---------|
| `packages/shared/src/constants.ts` | Add `TRUST_LEVELS` const | Define `supervised` / `autonomous` |
| `packages/shared/src/types/agent.ts` | Add `trustLevel` to Agent type | Type safety |
| `packages/db/src/schema/agents.ts` | Add `trustLevel` column | Persist trust level per agent |
| `server/src/services/trust.ts` | **New file** | `evaluateTrust()`, `countConsecutiveSuccesses()`, `countRecentFailures()`, `promoteTrust()`, `demoteTrust()`, `setTrustLevel()` |
| `server/src/services/heartbeat.ts` | Call trust service from `finalizeAgentStatus` (~line 881) | Evaluate trust after each run completes |
| `server/src/routes/approvals.ts` | Check trust level in `POST /approvals` handler (~line 56) | Auto-resolve `hire_agent` for autonomous agents |
| `server/src/services/activity-log.ts` | Log trust transitions | Audit trail entries |
| `server/src/routes/agents.ts` | Add `PATCH /agents/:id/trust` endpoint | Manual trust override by operators |
| `ui/src/pages/AgentDetail.tsx` | Trust badge next to status, progress in metadata | Operator visibility |
| Migration file | `ALTER TABLE agents ADD COLUMN trust_level` | Schema migration |

## Remaining Open Questions (for maintainer discussion)

1. **Per-company configurable thresholds?** RFC proposes fixed defaults (20 for promotion, 3-in-10 for demotion). Maintainers may want operator-configurable thresholds.
2. **Future trust levels?** A `probation` level (stricter than `supervised`) for demoted agents could be added later. Worth mentioning as future work.
3. **Trust and budget interaction?** Should trust level affect budget limits? Probably out of scope but worth flagging.
4. **Trust on agent list page?** Should the trust badge also appear on the agents list view, or only on detail? Defer to maintainer preference.

## Contribution Strategy

1. **Discuss in Discord #dev** — Contributing guidelines require rough agreement before bigger changes
2. **File RFC issue** — Follow the #219 format: Problem, Alternatives, Proposed Design with DDL, Files to Change, Edge Cases, Out of Scope
3. **Get maintainer feedback** — Iterate on the RFC based on comments
4. **Ship PR** — One logical change, all checks passing, clear description with before/after screenshots

## Next Steps

- Run `/workflows:plan` to create the implementation plan
- Draft the RFC issue text
- Post in Discord #dev for initial feedback
