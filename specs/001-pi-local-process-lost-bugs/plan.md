---
title: "Implementation plan: fix pi_local process_lost failures"
date: 2026-03-11
bead: bd-2te
---

<!-- Codex Review: Round 3 pending | model: gpt-5.3-codex | date: 2026-03-11 -->

# Implementation Plan

## Approach Summary

Three targeted changes in two files, plus the UI fix already applied. No schema changes, no new dependencies, no behavioral changes for legitimately running processes.

1. Make startup reap synchronous with retry
2. Add liveness guards to both coalescing paths (only for "running" status runs)
3. Simplify periodic reaper: tracked processes are always skipped; untracked processes are reaped when stale
4. Retain the UI fix (pi_local in isLocal)

## Architecture Decisions

### Why `await` instead of `void` for startup reap

The startup reap at `server/src/index.ts:502` currently fires as `void` — fire-and-forget. The reap is the primary defense against zombie runs from previous server instances.

The entire heartbeat setup block (lines 498-526) runs **before** `server.listen()` (line 582). No HTTP requests or WebSocket-triggered wakeups can arrive until after `listen()`. The `setInterval` timer is set up at line 506, but `setInterval` callbacks don't fire until the current event loop turn completes. So `await`ing the reap before `setInterval` is created guarantees:
- All zombies are cleared before the first timer tick
- No race between reap and early wakeup requests

**Failure handling:** If the startup reap fails, retry once. If still fails, log a critical error and proceed — the periodic reaper serves as a degraded backstop. Recovery is not immediate in this failure case (it takes up to the staleness threshold), but startup reap failure should be extremely rare (it's a simple DB query).

### Why check `runningProcesses` ONLY for "running" status runs in coalescing

The coalescing paths at lines ~1800 and ~1990 merge wakeup context into existing runs. The `activeExecutionRun` variable can be either "queued" or "running" (see heartbeat.ts:1725).

- **Queued runs** don't have processes yet — `runningProcesses.has()` would always be false. Coalescing into queued runs is always valid and must not be gated.
- **Running runs** should have a tracked process. If `runningProcesses.has()` returns false for a "running" run, it's a zombie.

So the liveness guard is: `if (run.status === "running" && !runningProcesses.has(run.id))` → skip coalescing.

### Why tracked processes are ALWAYS skipped by the periodic reaper

The `runningProcesses` Map is the ground truth for "this process is alive on this server." A run in the Map has a live `ChildProcess` handle. The reaper must never kill a tracked run.

The original spec AC #3 suggested reaping "tracked but hung" processes using staleness. However, `updatedAt` is only set during run setup (heartbeat.ts:1157, 1202) — **log streaming does NOT update `updatedAt`** (heartbeat.ts:1206-1211 write to log store, not the runs table). This means a legitimate 10-minute run would appear "stale" after 5 minutes and get falsely reaped.

Hung process detection would require a keepalive mechanism (e.g., periodic `updatedAt` writes during execution, or process exit code monitoring). That's a separate concern and out of scope for this fix. The current approach is:

- **Tracked runs**: Always skip. The Map is authoritative.
- **Untracked runs**: Apply staleness threshold. If stale beyond threshold, reap.
- **Startup reap (no threshold)**: Reap ALL untracked runs immediately.

This matches the existing reaper structure exactly — the only effective change is that **coalescing no longer refreshes `updatedAt` on zombies**, so the existing staleness check finally works.

### What happens to wakeups for zombie agents

When a timer tick fires for an agent with a zombie run and coalescing is blocked:
1. `runningProcesses.has(activeExecutionRun.id)` returns `false`
2. The coalescing path is skipped
3. The wakeup falls through to create a new queued run (or is deferred)
4. `startNextQueuedRunForAgent()` is called, but `countRunningRunsForAgent()` still returns 1 (zombie)
5. The new run stays queued until the startup reap or periodic reaper clears the zombie

This is correct — the reaper clears the zombie within 5 minutes (or immediately at startup), then queued runs execute. The agent recovers automatically.

## Change Map

### File 1: `server/src/index.ts`

**Lines 498-526** — Heartbeat scheduler setup

Change startup reap from `void` to `await` with retry:

```typescript
// Reap orphaned runs at startup (no threshold -- runningProcesses is empty)
// Must complete before setInterval to prevent timer ticks from coalescing into zombies
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    const result = await heartbeat.reapOrphanedRuns();
    logger.info(
      { reaped: result.reaped, runIds: result.runIds },
      "startup reap of orphaned heartbeat runs complete",
    );
    break;
  } catch (err) {
    if (attempt < 2) {
      logger.warn({ err, attempt }, "startup reap failed, retrying");
    } else {
      logger.error(
        { err },
        "startup reap of orphaned heartbeat runs failed after retry — periodic reaper will serve as degraded backstop",
      );
    }
  }
}

// Timer ticks start AFTER startup reap completes
setInterval(() => {
  // ... existing timer tick and periodic reap logic unchanged
}, config.heartbeatSchedulerIntervalMs);
```

### File 2: `server/src/services/heartbeat.ts`

**Change A: Issue-scoped coalescing (lines ~1795-1825)**

Add a liveness guard that only applies to "running" status:

```typescript
const isZombieRun =
  activeExecutionRun.status === "running" &&
  !runningProcesses.has(activeExecutionRun.id);

if (isSameExecutionAgent && !shouldQueueFollowupForCommentWake && !isZombieRun) {
  // ... existing coalescing logic (merge context, set updatedAt)
}
```

When `isZombieRun` is true, coalescing is skipped and the wakeup falls through to the deferred/new-run path. Queued runs (`status !== "running"`) are never flagged as zombies.

**Change B: Non-issue-scoped coalescing (lines ~1980-1998)**

Apply liveness check as a conditional filter using a two-step pattern (avoids `const` reassignment):

```typescript
const rawCoalescedTarget =
  sameScopeQueuedRun ??
  (shouldQueueFollowupForCommentWake ? null : sameScopeRunningRun ?? null);

// Don't coalesce into a zombie run (running in DB but no live process)
const coalescedTargetRun =
  rawCoalescedTarget?.status === "running" && !runningProcesses.has(rawCoalescedTarget.id)
    ? null
    : rawCoalescedTarget;
```

**Change C: Reaper — no code changes needed**

The existing reaper logic at lines 897-948 already:
1. Skips runs in `runningProcesses` (line 910)
2. Applies staleness threshold for untracked runs (line 913-916)
3. Reaps everything untracked when no threshold (startup reap)

This logic is correct. The only reason it failed before was that coalescing kept refreshing `updatedAt` on zombie runs, preventing them from becoming "stale." With Changes A and B, `updatedAt` freezes on zombies, and the existing reaper catches them after 5 minutes.

### File 3: `ui/src/components/AgentConfigForm.tsx` (already applied)

- `pi_local` added to `isLocal` check (line ~277)
- Command placeholder "pi" for pi_local (line ~612)
- Model required and groupByProvider for pi_local (line ~635)
- Pi thinking effort options wired (lines ~151, ~355, ~367, ~375)

## Spec Acceptance Criteria Reconciliation

| AC | Plan Approach | Notes |
|----|--------------|-------|
| AC1: Startup reap clears zombies before first tick | ✅ `await` with retry guarantees ordering | Degraded recovery on double failure via periodic reaper |
| AC2: Coalescing doesn't refresh zombie updatedAt | ✅ Liveness guard on both paths | Only gates "running" status; queued runs unaffected |
| AC3: Periodic reaper uses process liveness | ✅ Existing logic works once coalescing is fixed | Tracked runs always skipped (Map is authoritative); untracked runs reaped when stale |
| AC4: UI fix retained | ✅ Already applied | No further changes needed |
| AC5: No manual intervention after restart | ✅ Startup reap + periodic backstop | Immediate recovery on startup reap success; 5-min delayed recovery on startup reap failure |

## Blast Radius

- **server/src/index.ts**: Only the startup sequence is affected. Normal operation unchanged.
- **server/src/services/heartbeat.ts**: Only the two coalescing paths affected. Reaper, executor, run lifecycle, and all other logic untouched.
- **All adapters benefit**: Not pi_local-specific.
- **No schema changes**: No migrations needed.
- **No API changes**: No route behavior changes.

## Verification Strategy

### Unit tests (new)

1. **Coalescing skips zombie "running" runs (issue-scoped)**: Mock `runningProcesses` as empty. Create a "running" DB row. Call `enqueueWakeup` with issue-scoped context. Verify a new queued run is created, not coalesced, and zombie's `updatedAt` is unchanged.

2. **Coalescing skips zombie "running" runs (non-issue-scoped)**: Same as above for the non-issue path.

3. **Coalescing preserves queued-run behavior**: Create a "queued" DB row. Call `enqueueWakeup`. Verify coalescing works normally (wakeup merges into queued run).

4. **Reaper reaps untracked stale runs**: Create a "running" DB row with `updatedAt` 10 minutes ago. `runningProcesses` empty. Call `reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })`. Verify reaped.

5. **Reaper skips untracked fresh runs**: Create a "running" DB row with `updatedAt` 1 minute ago. `runningProcesses` empty. Call `reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })`. Verify NOT reaped.

6. **Startup reap reaps all untracked**: Create multiple "running" and "queued" rows. `runningProcesses` empty. Call `reapOrphanedRuns()` (no threshold). Verify ALL reaped.

### Manual verification

1. Start `pnpm dev`, trigger pi_local heartbeat, wait for "running" with adapter event
2. Kill server (Ctrl+C), restart `pnpm dev`
3. Check for "startup reap of orphaned heartbeat runs complete" with reaped count > 0
4. Verify agent status is idle
5. Trigger new heartbeat — should succeed
6. Verify Groove Jones claude_local agents still function

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Startup reap fails twice | Very Low | Medium | Periodic reaper backstop; critical error logged |
| Coalescing guard false-negative on queued runs | None | N/A | Guard checks `status === "running"` only |
| Reaper false positive during claim-to-register window | Very Low | Low | 5-min staleness threshold; window is ~100-500ms |
| `runningProcesses` import not available | None | N/A | Already imported at heartbeat.ts line 20 |
