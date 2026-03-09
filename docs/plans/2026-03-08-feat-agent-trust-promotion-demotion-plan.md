---
title: "feat: Agent Trust Promotion / Demotion System"
type: feat
date: 2026-03-08
brainstorm: docs/brainstorms/2026-03-08-agent-trust-promotion-brainstorm.md
contribution: https://github.com/paperclipai/paperclip
---

# feat: Agent Trust Promotion / Demotion System

## Overview

An automated trust progression system for Paperclip agents. Agents start as `supervised` (current behavior — all actions need board approval) and can earn `autonomous` status through 20 consecutive successful heartbeat runs. Autonomous agents auto-approve `hire_agent` requests without board intervention. Trust is revoked automatically after 3 failures in a rolling window of 10 decisive runs.

This is a novel contribution — nobody in the Paperclip ecosystem has built or proposed this. It directly serves the project's mission of making autonomous companies "more capable, more governable, more scalable."

## Problem Statement

Paperclip has approval gates (board approves agent hires and CEO strategies) but no automated trust progression. An agent that succeeds 50 times in a row has the same permissions as one that just got created. There is no path from governance to earned autonomy.

This creates friction: as agent workforces scale, every hire request requires manual board approval regardless of the requesting agent's track record. Operators managing hundreds of agents cannot sustainably approve every routine hire.

## Proposed Solution

Add a `trustLevel` field to agents (`supervised` | `autonomous`) with automated promotion/demotion logic and a manual override escape hatch.

**Core mechanics:**
- **Promotion**: 20 consecutive `succeeded` heartbeat runs → `supervised` → `autonomous`
- **Demotion**: 3 `failed` runs (excluding `process_lost`) in a rolling window of 10 decisive runs → `autonomous` → `supervised`
- **Gating**: Autonomous agents auto-approve `hire_agent` requests; `approve_ceo_strategy` always requires human sign-off
- **Manual override**: Board operators can force promote/demote via `PATCH /agents/:id/trust`

## Alternative Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Manual-only promotion** | Simple, full operator control | Doesn't scale — operators must manually track agent performance and promote | Too much friction at scale |
| **Continuous score (0-100)** | Fine-grained, flexible thresholds per approval type | Complex to configure, hard to reason about, unclear what "score 73" means | Over-engineered for v1 |
| **Status quo (no trust)** | Zero implementation cost | Agents never earn autonomy; every hire needs manual approval forever | Fails the "more capable" goal |
| **2-level automated (chosen)** | Simple binary model, clear semantics, earns itself, auto-demotes on failure patterns | Less granularity than a score | Right complexity for v1 |

## Technical Approach

### Architecture

```
┌──────────────────────┐
│   finalizeAgentStatus │ ← called after every heartbeat run completion
│   (heartbeat.ts)      │
└──────────┬───────────┘
           │ evaluateTrust(db, agentId, outcome)
           ▼
┌──────────────────────┐
│   trustService        │ ← NEW: server/src/services/trust.ts
│   (trust.ts)          │
│                       │
│  countConsecutive-    │──► queries heartbeat_runs
│  Successes()          │    (backward scan, max 20 rows)
│                       │
│  countRecentFailures()│──► queries heartbeat_runs
│                       │    (rolling window of 10 decisive runs)
│                       │
│  promoteTrust()       │──► UPDATE agents SET trustLevel
│  demoteTrust()        │    WHERE clause guard (idempotent)
│  setTrustLevel()      │    + logActivity()
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  approvalService      │
│  (approvals.ts)       │
│                       │
│  create() ────────────│──► if hire_agent + autonomous requester
│                       │    → auto-approve immediately
└──────────────────────┘
```

### Data Model

No new tables. One column added to `agents`, one optional timestamp for manual override protection:

```sql
-- Migration: add trust_level to agents
ALTER TABLE "agents" ADD COLUMN "trust_level" text NOT NULL DEFAULT 'supervised';
ALTER TABLE "agents" ADD COLUMN "trust_manually_set_at" timestamp with time zone;
```

Trust counters are **computed from `heartbeat_runs`** at evaluation time — no persisted counter columns. This avoids counter-sync bugs and keeps the schema minimal. The existing index `heartbeat_runs_company_agent_started_idx` on `(companyId, agentId, startedAt)` supports efficient backward scans.

### Rolling Window Semantics

Only **decisive runs** (`succeeded` or `failed`) count in the window. `cancelled` and `timed_out` runs are fully invisible to the trust system — they don't occupy slots in the rolling window and don't count toward any threshold.

Infrastructure failures (`errorCode = 'process_lost'` from `reapOrphanedRuns`) are excluded from the failure count — server restarts shouldn't penalize agents.

### TOCTOU Race Protection

When an operator manually overrides trust level, `trustManuallySetAt` is set. The evaluation logic skips demotion if `trustManuallySetAt` is within the last 5 minutes. This prevents in-flight evaluations from immediately re-demoting an agent the operator just promoted.

The WHERE clause guard (`UPDATE ... WHERE trustLevel = 'supervised'` for promotion, `WHERE trustLevel = 'autonomous'` for demotion) makes all trust updates idempotent against concurrent run completions.

### Error Isolation

Trust evaluation is wrapped in try/catch within `finalizeAgentStatus`. If the trust query or update fails, the error is logged but does NOT prevent the agent's operational status from being updated. Trust is advisory; operational status is critical.

### Auto-Approval Flow

Auto-skip logic lives in `approvalService.create()` (service layer), not in route handlers. This ensures it works for both entry points:
1. `POST /companies/:companyId/approvals` (approvals route)
2. `POST /companies/:companyId/agent-hires` (agents route, the primary path for agent-initiated hires)

When a `hire_agent` approval is created by an autonomous agent:
1. Approval record created with `status: "pending"` (preserves audit trail)
2. Immediately auto-resolved: call `approve()` with `decidedByUserId: null`, `decisionNote: "Auto-approved: autonomous trust level"`
3. Existing `approve()` logic handles agent activation + hire hook notification
4. Wakeup of requesting agent is **skipped** (agent is already mid-run)

The `approve()` method signature changes from `(id: string, decidedByUserId: string, ...)` to `(id: string, decidedByUserId: string | null, ...)` to support system-initiated approvals.

## Implementation Phases

### Phase 1: Schema + Shared Types

**Files:**
- `packages/shared/src/constants.ts` — Add `TRUST_LEVELS` const + `TrustLevel` type
- `packages/shared/src/types/agent.ts` — Add `trustLevel` to `Agent` interface
- `packages/shared/src/validators/agent.ts` — Add trust level to update schema, add `setAgentTrustSchema`
- `packages/db/src/schema/agents.ts` — Add `trustLevel` and `trustManuallySetAt` columns
- Migration file — Auto-generated via `pnpm db:generate`

```typescript
// packages/shared/src/constants.ts
export const TRUST_LEVELS = ["supervised", "autonomous"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const TRUST_PROMOTION_THRESHOLD = 20;
export const TRUST_DEMOTION_FAILURE_THRESHOLD = 3;
export const TRUST_DEMOTION_WINDOW_SIZE = 10;
```

```typescript
// packages/db/src/schema/agents.ts — add to pgTable definition
trustLevel: text("trust_level").notNull().default("supervised"),
trustManuallySetAt: timestamp("trust_manually_set_at", { withTimezone: true }),
```

**Verification:** `pnpm db:generate && pnpm -r typecheck`

### Phase 2: Trust Service

**Files:**
- `server/src/services/trust.ts` — **New file**: core trust evaluation logic
- `server/src/services/index.ts` — Export trust service

```typescript
// server/src/services/trust.ts
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, heartbeatRuns } from "@paperclipai/db";
import { TRUST_PROMOTION_THRESHOLD, TRUST_DEMOTION_FAILURE_THRESHOLD, TRUST_DEMOTION_WINDOW_SIZE } from "@paperclipai/shared";
import { logActivity } from "./activity-log.js";

export function trustService(db: Db) {

  async function countConsecutiveSuccesses(agentId: string): Promise<number> {
    const runs = await db.select({ status: heartbeatRuns.status })
      .from(heartbeatRuns)
      .where(and(
        eq(heartbeatRuns.agentId, agentId),
        inArray(heartbeatRuns.status, ["succeeded", "failed"]),
      ))
      .orderBy(desc(heartbeatRuns.finishedAt))
      .limit(TRUST_PROMOTION_THRESHOLD);

    let count = 0;
    for (const run of runs) {
      if (run.status !== "succeeded") break;
      count++;
    }
    return count;
  }

  async function countRecentFailures(agentId: string): Promise<number> {
    const runs = await db.select({
      status: heartbeatRuns.status,
      errorCode: heartbeatRuns.errorCode,
    })
      .from(heartbeatRuns)
      .where(and(
        eq(heartbeatRuns.agentId, agentId),
        inArray(heartbeatRuns.status, ["succeeded", "failed"]),
      ))
      .orderBy(desc(heartbeatRuns.finishedAt))
      .limit(TRUST_DEMOTION_WINDOW_SIZE);

    return runs.filter(r =>
      r.status === "failed" && r.errorCode !== "process_lost"
    ).length;
  }

  async function evaluateTrust(
    agentId: string,
    outcome: "succeeded" | "failed" | "cancelled" | "timed_out",
  ): Promise<void> {
    // Only evaluate on decisive outcomes
    if (outcome !== "succeeded" && outcome !== "failed") return;

    const agent = await db.select({
      id: agents.id,
      companyId: agents.companyId,
      trustLevel: agents.trustLevel,
      trustManuallySetAt: agents.trustManuallySetAt,
    })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then(rows => rows[0] ?? null);

    if (!agent) return;

    // Skip evaluation if trust was manually set in the last 5 minutes
    if (agent.trustManuallySetAt) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (new Date(agent.trustManuallySetAt) > fiveMinutesAgo) return;
    }

    if (outcome === "succeeded" && agent.trustLevel === "supervised") {
      const consecutive = await countConsecutiveSuccesses(agentId);
      if (consecutive >= TRUST_PROMOTION_THRESHOLD) {
        await promoteTrust(agentId, agent.companyId);
      }
    } else if (outcome === "failed" && agent.trustLevel === "autonomous") {
      const failures = await countRecentFailures(agentId);
      if (failures >= TRUST_DEMOTION_FAILURE_THRESHOLD) {
        await demoteTrust(agentId, agent.companyId);
      }
    }
  }

  async function promoteTrust(agentId: string, companyId: string): Promise<boolean> {
    const updated = await db.update(agents)
      .set({ trustLevel: "autonomous", updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.trustLevel, "supervised")))
      .returning()
      .then(rows => rows[0] ?? null);

    if (updated) {
      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: agentId,
        action: "agent.trust_promoted",
        entityType: "agent",
        entityId: agentId,
        agentId,
        details: { from: "supervised", to: "autonomous", trigger: "automatic" },
      });
    }
    return !!updated;
  }

  async function demoteTrust(agentId: string, companyId: string): Promise<boolean> {
    const updated = await db.update(agents)
      .set({ trustLevel: "supervised", updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.trustLevel, "autonomous")))
      .returning()
      .then(rows => rows[0] ?? null);

    if (updated) {
      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: agentId,
        action: "agent.trust_demoted",
        entityType: "agent",
        entityId: agentId,
        agentId,
        details: { from: "autonomous", to: "supervised", trigger: "automatic" },
      });
    }
    return !!updated;
  }

  async function setTrustLevel(
    agentId: string,
    companyId: string,
    trustLevel: "supervised" | "autonomous",
    actorId: string,
  ): Promise<void> {
    const now = new Date();
    await db.update(agents)
      .set({ trustLevel, trustManuallySetAt: now, updatedAt: now })
      .where(eq(agents.id, agentId));

    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId,
      action: trustLevel === "autonomous" ? "agent.trust_promoted" : "agent.trust_demoted",
      entityType: "agent",
      entityId: agentId,
      agentId,
      details: { to: trustLevel, trigger: "manual" },
    });
  }

  return {
    evaluateTrust,
    countConsecutiveSuccesses,
    countRecentFailures,
    setTrustLevel,
  };
}
```

**Tests:** `server/src/__tests__/trust.test.ts` — Unit tests for:
- `countConsecutiveSuccesses` with various run histories
- `countRecentFailures` with process_lost exclusion
- `evaluateTrust` promotion at threshold boundary
- `evaluateTrust` demotion at failure threshold
- Idempotent promotion/demotion (already at target level)
- Manual override cooldown (5-minute window)
- Neutral outcomes (cancelled/timed_out) skipped

### Phase 3: Heartbeat Integration

**Files:**
- `server/src/services/heartbeat.ts` — Call trust service from `finalizeAgentStatus` (~line 881)

```typescript
// In finalizeAgentStatus, after the status update (line ~880):
// Trust evaluation — non-blocking, errors logged but don't prevent status update
try {
  await trustSvc.evaluateTrust(agentId, outcome);
} catch (err) {
  log.error({ err, agentId, outcome }, "Trust evaluation failed");
}
```

The trust service is instantiated alongside other services at the top of `heartbeatService()`:
```typescript
const trustSvc = trustService(db);
```

### Phase 4: Approval Auto-Skip

**Files:**
- `server/src/services/approvals.ts` — Add auto-approve logic in `create()`, update `approve()` signature

**Changes to `approve()` signature:**
```typescript
// Before:
approve: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
// After:
approve: async (id: string, decidedByUserId: string | null, decisionNote?: string | null) => {
```

**Changes to `create()`:**
```typescript
create: async (companyId: string, data: Omit<typeof approvals.$inferInsert, "companyId">) => {
  const approval = await db.insert(approvals)
    .values({ ...data, companyId })
    .returning()
    .then(rows => rows[0]);

  // Auto-approve hire_agent for autonomous agents
  if (
    approval.type === "hire_agent" &&
    data.requestedByAgentId
  ) {
    const requester = await agentsSvc.getById(data.requestedByAgentId);
    if (requester?.trustLevel === "autonomous") {
      const resolved = await approve(
        approval.id,
        null,
        "Auto-approved: autonomous trust level",
      );
      return resolved;
    }
  }

  return approval;
},
```

The `approve` internal function reference needs to be accessible from `create`. Restructure to use named functions in the closure (same pattern as `getExistingApproval`).

**Activity log for auto-approvals:**
The existing `approve()` method already logs `approval.approved` activity. For auto-approvals, `actorType: "system"` and `actorId: "trust_auto_approval"`.

### Phase 5: Manual Override Endpoint

**Files:**
- `server/src/routes/agents.ts` — Add `PATCH /agents/:id/trust` endpoint
- `packages/shared/src/validators/agent.ts` — Add `setAgentTrustSchema`

```typescript
// packages/shared/src/validators/agent.ts
export const setAgentTrustSchema = z.object({
  trustLevel: z.enum(TRUST_LEVELS),
});

// server/src/routes/agents.ts
router.patch("/agents/:id/trust", validate(setAgentTrustSchema), async (req, res) => {
  assertBoard(req);
  const id = req.params.id as string;
  const existing = await svc.getById(id);
  if (!existing) { res.status(404).json({ error: "Agent not found" }); return; }
  assertCompanyAccess(req, existing.companyId);

  const actor = getActorInfo(req);
  await trustSvc.setTrustLevel(id, existing.companyId, req.body.trustLevel, actor.actorId);

  const updated = await svc.getById(id);
  res.json(updated);
});
```

### Phase 6: UI — Trust Badge + Progress

**Files:**
- `ui/src/lib/status-colors.ts` — Add trust level color mappings
- `ui/src/pages/AgentDetail.tsx` — Trust badge next to status, progress in metadata
- `ui/src/api/agents.ts` — Add trust update mutation

**Status colors:**
```typescript
// ui/src/lib/status-colors.ts
export const trustBadge: Record<string, string> = {
  supervised: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  autonomous: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};
```

**Agent detail page changes:**
1. Trust badge next to existing `StatusBadge`: `idle · supervised` or `running · autonomous`
2. Promotion progress in metadata section: `"14/20 consecutive successes toward autonomous"` for supervised agents
3. Manual override dropdown near trust badge (board operators only)

**Trust progress query:** Add a new API endpoint `GET /agents/:id/trust-progress` that returns `{ trustLevel, consecutiveSuccesses, recentFailures }`. This keeps the main agent query clean and makes the trust progress an opt-in detail.

```typescript
// server/src/routes/agents.ts
router.get("/agents/:id/trust-progress", async (req, res) => {
  const id = req.params.id as string;
  const existing = await svc.getById(id);
  if (!existing) { res.status(404).json({ error: "Agent not found" }); return; }
  assertCompanyAccess(req, existing.companyId);

  const consecutiveSuccesses = await trustSvc.countConsecutiveSuccesses(id);
  const recentFailures = await trustSvc.countRecentFailures(id);

  res.json({
    trustLevel: existing.trustLevel,
    consecutiveSuccesses,
    recentFailures,
    promotionThreshold: TRUST_PROMOTION_THRESHOLD,
    demotionThreshold: TRUST_DEMOTION_FAILURE_THRESHOLD,
    demotionWindowSize: TRUST_DEMOTION_WINDOW_SIZE,
  });
});
```

### Phase 7: RFC Issue + PR

**Deliverable 1: RFC Issue** — File as a GitHub issue following the #219 format:
1. Problem — Agents have no path to earned autonomy
2. Why a New Primitive? — Comparison table (manual, numeric, status quo)
3. Proposed Design — Schema DDL, trust service architecture, approval integration, UI mockups
4. Files to Create/Change — Explicit table
5. Edge Cases — Full table from brainstorm
6. Out of Scope — Per-company thresholds, additional trust levels, budget interaction

**Deliverable 2: PR** — One logical change, all checks passing:
- `pnpm -r typecheck && pnpm test:run && pnpm build`
- Clear description with before/after screenshots of the UI
- Address all Greptile reviewer comments

## Acceptance Criteria

### Functional Requirements

- [x] Agents start with `trustLevel: "supervised"` (default)
- [x] After 20 consecutive `succeeded` heartbeat runs, agent is promoted to `autonomous`
- [x] After 3 `failed` runs (excluding `process_lost`) in rolling window of 10 decisive runs, agent is demoted to `supervised`
- [x] `cancelled` and `timed_out` runs are neutral — do not affect trust
- [x] Autonomous agents auto-approve `hire_agent` requests (approval record created + immediately resolved)
- [x] `approve_ceo_strategy` always requires board approval regardless of trust
- [x] Board operators can manually set trust level via `PATCH /agents/:id/trust`
- [x] Manual override sets `trustManuallySetAt` to prevent immediate re-demotion
- [x] Trust is preserved across agent pause/resume
- [x] Trust evaluation does not run for terminated agents
- [x] All trust transitions are logged to `activity_log`
- [x] Trust badge displayed next to status badge on agent detail page
- [x] Promotion progress shown in agent metadata section

### Non-Functional Requirements

- [x] Trust evaluation wrapped in try/catch — failures do not block `finalizeAgentStatus`
- [x] Trust updates are idempotent (WHERE clause guards)
- [x] Concurrent run completions cannot cause double-promotion
- [x] heartbeat_runs queries are bounded (max 20 rows for promotion, 10 for demotion)
- [x] All existing tests continue to pass
- [x] Type-safe across db/shared/server/ui layers

### Quality Gates

- [x] `pnpm -r typecheck` passes
- [x] `pnpm test:run` passes (including new trust tests)
- [x] `pnpm build` succeeds
- [x] No new lint warnings

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Concurrent runs completing | WHERE clause guard. Only one promotion/demotion succeeds. |
| Terminated agent | `finalizeAgentStatus` returns early. Trust evaluation never runs. |
| New agent activation | Trust starts as `supervised`. Counter at 0. |
| Agent in error status | Trust evaluation still runs. Failed run counts toward demotion. |
| Demoted during active auto-approval | Already-approved hires stand. Future hires need board approval. |
| Agent paused then resumed | Trust level preserved. |
| Rolling window < 10 total runs | Use actual run count as window. 3 failures in 5 runs triggers demotion. |
| Manual override then auto-evaluation | `trustManuallySetAt` prevents re-demotion within 5 minutes. |
| Process_lost failures | Excluded from demotion count. Infrastructure failures don't penalize agents. |
| requireBoardApprovalForNewAgents = false | Trust is irrelevant — agents are hired directly without approval records. |
| Auto-approval wakeup | Skipped — requesting agent is already mid-run. |
| Trust service throws error | Caught and logged. `finalizeAgentStatus` completes normally. |

## Out of Scope (future work)

- Per-company configurable promotion/demotion thresholds
- Additional trust levels (e.g., `probation` for demoted agents)
- Trust-gated permissions beyond approval auto-skip
- Trust impact on agent budget limits
- Anti-gaming measures (preventing agents from creating trivial self-wakeups to inflate success count)
- One-time backfill of trust levels for existing high-performing agents
- Trust badge on agent list page (defer to maintainer preference)

## Files to Create/Change

| Layer | File | Action | Description |
|-------|------|--------|-------------|
| Shared | `packages/shared/src/constants.ts` | Modify | Add `TRUST_LEVELS`, `TrustLevel`, threshold constants |
| Shared | `packages/shared/src/types/agent.ts` | Modify | Add `trustLevel` + `trustManuallySetAt` to Agent interface |
| Shared | `packages/shared/src/validators/agent.ts` | Modify | Add `setAgentTrustSchema` |
| DB | `packages/db/src/schema/agents.ts` | Modify | Add `trustLevel` + `trustManuallySetAt` columns |
| DB | `packages/db/src/migrations/XXXX_*.sql` | Create | Auto-generated migration |
| Server | `server/src/services/trust.ts` | **Create** | Trust evaluation service |
| Server | `server/src/services/index.ts` | Modify | Export trust service |
| Server | `server/src/services/heartbeat.ts` | Modify | Call trust service from `finalizeAgentStatus` |
| Server | `server/src/services/approvals.ts` | Modify | Auto-approve logic in `create()`, nullable `decidedByUserId` |
| Server | `server/src/routes/agents.ts` | Modify | Add `PATCH /agents/:id/trust` + `GET /agents/:id/trust-progress` |
| UI | `ui/src/lib/status-colors.ts` | Modify | Add trust badge colors |
| UI | `ui/src/pages/AgentDetail.tsx` | Modify | Trust badge + progress display + manual override |
| UI | `ui/src/api/agents.ts` | Modify | Add trust update + progress query methods |
| Tests | `server/src/__tests__/trust.test.ts` | **Create** | Trust service unit tests |

## Contribution Strategy

1. **Discord #dev** — Post a summary of the RFC for initial feedback before filing the issue
2. **RFC issue** — File following #219 format with full design, DDL, and edge cases
3. **Iterate** — Address maintainer feedback on the RFC
4. **PR** — Implement as one logical change with all checks passing and before/after UI screenshots

## References

- Brainstorm: `docs/brainstorms/2026-03-08-agent-trust-promotion-brainstorm.md`
- RFC format example: https://github.com/paperclipai/paperclip/issues/219
- Heartbeat finalization: `server/src/services/heartbeat.ts:851-895`
- Approval flow: `server/src/services/approvals.ts:36-107`
- Agent-hires route: `server/src/routes/agents.ts:636-728`
- Agent detail page: `ui/src/pages/AgentDetail.tsx`
- Status badge component: `ui/src/components/StatusBadge.tsx`
- Activity logging: `server/src/services/activity-log.ts`
- Contributing guidelines: `CONTRIBUTING.md`, `AGENTS.md`
