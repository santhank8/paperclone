---
title: "Planning transcript: fix pi_local process_lost failures"
date: 2026-03-11
bead: bd-2te
---

# Planning Transcript

## Collaboration Attempts

Two challenger agents were spawned via pi_messenger:
1. **BrightTiger** (crew-challenger) — spawned, read 8 tool calls / 200k tokens, went idle without sending a message. Dismissed after ~5 minutes.
2. **EpicArrow** (crew-challenger) — spawned, read 7 tool calls / 245k tokens, went idle without sending a message. Dismissed after ~4 minutes.

Both challengers appeared to complete their analysis but did not send a response message. This may be a crew-challenger configuration issue where the initial prompt doesn't trigger a pi_messenger send action.

## Self-Challenge (EpicLion)

Since no challenger produced a response, I conducted a rigorous self-challenge. Here's what I verified:

### Edge Case 1: Startup reap race condition
**Concern:** Could the startup `await` race with early HTTP requests or timer ticks?
**Verification:** Read `server/src/index.ts` lines 490-585. The heartbeat setup block (lines 498-526) runs before `server.listen()` (line 582). HTTP routes only handle requests after listen. WebSocket is set up earlier (line 496) but wakeups come through HTTP routes. `setInterval` callbacks don't fire until the current event loop turn completes. **No race possible.** The await guarantees all zombies are cleared before any timer tick or wakeup.

### Edge Case 2: False positive in coalescing liveness check
**Concern:** What if a run is legitimately starting but hasn't registered in `runningProcesses` yet?
**Verification:** Read `claimQueuedRun()` (line 816) and `runChildProcess()` (adapter-utils line 295). There's a window between DB status="running" (claimQueuedRun line 822) and `runningProcesses.set()` (adapter-utils line 307). During this window, coalescing would be skipped because `runningProcesses.has()` returns false.
**Impact:** Low. The wakeup creates a new queued run instead of coalescing. When the first run finishes, the queued run starts normally. Not a bug, just slightly wasteful. This window is ~100-500ms, and timer ticks are every 30 seconds — collision probability is negligible.

### Edge Case 3: Periodic reaper false positive
**Concern:** Should the periodic reaper also check `runningProcesses` directly?
**Verification:** The same claim-to-register window applies. If the periodic reaper immediately reaped anything not in `runningProcesses`, it would kill runs that are legitimately starting up. The existing 5-minute staleness threshold protects against this. Once coalescing stops refreshing `updatedAt` on zombies, the staleness check works correctly:
- Zombie runs: `updatedAt` frozen → stale after 5 min → reaped ✓
- Just-claimed runs: `updatedAt` is recent → not stale → not reaped ✓
**Decision:** Don't change the periodic reaper logic. Fixing coalescing is sufficient.

### Edge Case 4: Coalescing skip creates queued run pile-up
**Concern:** If coalescing is skipped for zombie agents, do queued runs pile up?
**Verification:** New runs are created as "queued" but can't start (zombie blocks `maxConcurrentRuns`). The periodic reaper clears the zombie within 5 minutes (or startup reap clears it immediately). After that, queued runs execute normally. The pile-up is temporary and self-healing.

### Edge Case 5: Transaction isolation for in-memory Map check
**Concern:** Is it safe to check `runningProcesses` (an in-memory Map) inside a DB transaction?
**Verification:** The Map is a plain JavaScript Map, not a DB operation. `Map.has()` is synchronous and has no interaction with DB transaction isolation. Completely safe.

## Conclusion

The proposed three-fix approach was validated with one refinement: Fix 3 (periodic reaper enhancement) is unnecessary because fixing coalescing (Fix 2) makes the existing reaper logic sufficient. This simplifies the change to two targeted fixes plus the already-applied UI fix.
