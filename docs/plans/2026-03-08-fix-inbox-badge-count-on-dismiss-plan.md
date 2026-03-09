---
title: "Fix: Inbox Badge Count Doesn't Update on Dismiss"
type: fix
date: 2026-03-08
issue: https://github.com/paperclipai/paperclip/issues/314
---

# Fix: Inbox Badge Count Doesn't Update on Dismiss

## Overview

When a user dismisses a failed run from the Inbox, the item disappears from the list but the sidebar badge count stays at the old number. Dismissals live in localStorage while the badge is computed server-side — they never sync.

## Problem Statement

The sidebar badge is computed at `GET /companies/:companyId/sidebar-badges` using a DB query that counts the latest failed/timed_out run per active agent. The Inbox UI dismisses items by writing to `localStorage` under key `paperclip:inbox:dismissed`. The server has no knowledge of these dismissals, so the badge count never decrements.

## Proposed Solution

Move run dismissals from localStorage to the database:

1. Add a nullable `dismissed_at` column to `heartbeat_runs`
2. Create a `POST /heartbeat-runs/:runId/dismiss` endpoint
3. Update the sidebar badge query to exclude dismissed runs
4. Replace the localStorage dismiss with an API mutation in the Inbox UI

## Key Design Decisions

**Company-wide dismiss (not per-user).** Adding `dismissed_at` directly to the `heartbeat_runs` row means when User A dismisses a failed run, it's dismissed for all users in that company. This is intentional — it matches triage workflows where someone "handles" a failure for the team, and it's the approach the issue author proposed.

**Older failures surface after dismiss.** When an agent's latest failed run is dismissed, the sidebar badge query skips it and considers the next-most-recent run. If that run also failed, it surfaces in the Inbox. This is the most intuitive behavior — dismissing one failure doesn't suppress all older failures for that agent.

**Optimistic UI with revert on error.** The dismiss action should feel instant (like the current localStorage approach). The UI removes the card immediately and reverts if the API call fails, following the existing `markReadMutation` pattern.

**No undismiss in v1.** The `dismissed_at` column is nullable, so a future endpoint can clear it. Not needed for the initial fix.

**Alerts and stale issues remain in localStorage.** Only `run:*` dismissals move server-side. The `alert:*` and `stale:*` dismiss keys stay in localStorage — they don't have DB-backed entities to attach a timestamp to, and they don't contribute to the badge count mismatch.

## Technical Approach

### Files to Modify

| Layer | File | Change |
|-------|------|--------|
| DB Schema | `packages/db/src/schema/heartbeat_runs.ts` | Add `dismissedAt` column |
| Migration | Auto-generated via `pnpm db:generate` | `ALTER TABLE ADD COLUMN` |
| Shared Type | `packages/shared/src/types/heartbeat.ts` | Add `dismissedAt: Date \| null` |
| Service | `server/src/services/heartbeat.ts` | Add `dismissRun()` method |
| Service | `server/src/services/sidebar-badges.ts` | Filter `isNull(heartbeatRuns.dismissedAt)` |
| Route | `server/src/routes/agents.ts` | Add `POST /heartbeat-runs/:runId/dismiss` |
| UI API | `ui/src/api/heartbeats.ts` | Add `dismiss()` method |
| UI Page | `ui/src/pages/Inbox.tsx` | Replace localStorage dismiss with API mutation for runs |

### Step 1: Schema — Add `dismissed_at` to `heartbeat_runs`

**File:** `packages/db/src/schema/heartbeat_runs.ts`

Add after `updatedAt` (line 36):

```typescript
dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
```

Then generate the migration:

```bash
pnpm db:generate
```

This produces migration `0026_*.sql` with:

```sql
ALTER TABLE "heartbeat_runs" ADD COLUMN "dismissed_at" timestamp with time zone;
```

### Step 2: Shared Type — Add `dismissedAt` to `HeartbeatRun`

**File:** `packages/shared/src/types/heartbeat.ts`

Add after `updatedAt` (line 36):

```typescript
dismissedAt: Date | null;
```

### Step 3: Service — Add `dismissRun` to heartbeat service

**File:** `server/src/services/heartbeat.ts`

Add a new method following the `cancelRun` pattern. Key differences: no process killing, no status guard — dismiss is valid for any run status.

```typescript
dismissRun: async (runId: string) => {
  const run = await getRun(runId);
  if (!run) return null;
  if (run.dismissedAt) return run; // idempotent

  const [updated] = await db
    .update(heartbeatRuns)
    .set({ dismissedAt: new Date(), updatedAt: new Date() })
    .where(eq(heartbeatRuns.id, runId))
    .returning();
  return updated ?? null;
},
```

### Step 4: Service — Exclude dismissed runs from badge query

**File:** `server/src/services/sidebar-badges.ts`

Import `isNull` from `drizzle-orm` (line 1). Add filter to the `latestRunByAgent` query's `.where()` clause (line 32-37):

```typescript
.where(
  and(
    eq(heartbeatRuns.companyId, companyId),
    eq(agents.companyId, companyId),
    not(eq(agents.status, "terminated")),
    isNull(heartbeatRuns.dismissedAt),  // <-- new
  ),
)
```

This ensures dismissed runs are excluded **before** the `selectDistinctOn` picks the "latest run per agent," so an older undismissed failure can surface.

### Step 5: Route — Add `POST /heartbeat-runs/:runId/dismiss`

**File:** `server/src/routes/agents.ts`

Add after the cancel route (line 1367), following the same pattern:

```typescript
router.post("/heartbeat-runs/:runId/dismiss", async (req, res) => {
  assertBoard(req);
  const runId = req.params.runId as string;
  const run = await heartbeat.dismissRun(runId);
  if (!run) {
    res.status(404).json({ error: "Heartbeat run not found" });
    return;
  }
  assertCompanyAccess(req, run.companyId);
  await logActivity(db, {
    companyId: run.companyId,
    actorType: "user",
    actorId: req.actor.userId ?? "board",
    action: "heartbeat.dismissed",
    entityType: "heartbeat_run",
    entityId: run.id,
    details: { agentId: run.agentId },
  });
  res.json(run);
});
```

### Step 6: UI API — Add `dismiss` method

**File:** `ui/src/api/heartbeats.ts`

Add to `heartbeatsApi` object after `cancel` (line 40):

```typescript
dismiss: (runId: string) => api.post<HeartbeatRun>(`/heartbeat-runs/${runId}/dismiss`, {}),
```

### Step 7: UI — Replace localStorage dismiss with API mutation

**File:** `ui/src/pages/Inbox.tsx`

**7a.** Add a `dismissRunMutation` using `useMutation`:

```typescript
const dismissRunMutation = useMutation({
  mutationFn: (runId: string) => heartbeatsApi.dismiss(runId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
  },
});
```

**7b.** Update `FailedRunCard` dismiss handler — change from `dismiss(\`run:${run.id}\`)` to `dismissRunMutation.mutate(run.id)`.

**7c.** Update the `failedRuns` memo filter — change from `!dismissed.has(\`run:${r.id}\`)` to `!r.dismissedAt` (filter by the server-returned field instead of localStorage).

**7d.** Remove localStorage `run:*` entries from the `useDismissedItems` hook scope. The hook still handles `stale:*` and `alert:*` keys.

## Acceptance Criteria

- [x] Dismissing a failed run decrements the sidebar badge count immediately
- [x] Dismissed runs stay dismissed across browser sessions and devices
- [x] Dismissed runs are dismissed for all users in the company
- [x] If an agent's latest run is dismissed and an older run also failed, the older failure surfaces
- [x] Dismiss is idempotent — dismissing an already-dismissed run returns 200
- [x] The dismiss endpoint requires board (human) auth and company access
- [x] An activity log entry is created for each dismiss action
- [x] Stale issue and alert dismissals continue to work via localStorage
- [x] `pnpm -r typecheck`, `pnpm test:run`, and `pnpm build` all pass

## Edge Cases

- **Rapid-fire dismissals:** Each dismiss is an independent POST. TanStack Query deduplicates refetches via `invalidateQueries`.
- **Dismiss + concurrent new failure:** WebSocket `heartbeat.run.status` event already invalidates the badge query. The new failure appears as a fresh inbox item.
- **Existing localStorage dismissals:** After deploy, previously dismissed `run:*` items may briefly reappear until re-dismissed via the API. This is acceptable — the items are real failures that were only locally hidden.
- **Network failure on dismiss:** The mutation's `onError` can show a toast or silently fail. The card remains visible since the optimistic update reverts.

## Verification

Per AGENTS.md Section 7:

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

## References

- Issue: https://github.com/paperclipai/paperclip/issues/314
- Sidebar badge service: `server/src/services/sidebar-badges.ts`
- Cancel run route (pattern to follow): `server/src/routes/agents.ts:1349`
- Inbox dismiss hook: `ui/src/pages/Inbox.tsx:67-95`
- HeartbeatRun schema: `packages/db/src/schema/heartbeat_runs.ts`
