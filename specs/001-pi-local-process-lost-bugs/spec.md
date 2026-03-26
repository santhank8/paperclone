---
title: "Fix recurring pi_local process_lost failures"
date: 2026-03-11
bead: bd-2te
---

# Fix recurring pi_local process_lost failures

## Problem

Stock Wizard pi_local agents (CEO, Founding Engineer, Quant Strategist, Market Analyst) repeatedly fail with "Process lost -- server may have restarted" even when the server hasn't restarted, or after a single restart. Agents become permanently stuck in "running" state with no live process, blocking all future work.

## Root Cause Analysis

There are **three bugs** that compound into a death spiral. A single server restart triggers a cascade that permanently disables all pi_local agents until manual intervention.

### Bug 1: Timer tick coalescing refreshes updatedAt on zombie runs (CRITICAL)

**Location:** `server/src/services/heartbeat.ts` ~line 1800

When the heartbeat timer tick fires (every 30s), it calls `enqueueWakeup()` for agents whose interval has elapsed. If an agent already has a "running" run (the zombie), the wakeup is coalesced into the existing run — and `updatedAt` is set to `new Date()`.

The periodic reaper uses `staleThresholdMs: 5 * 60 * 1000` (5 min). It skips runs where `now - updatedAt < staleThresholdMs`. Since the timer tick refreshes `updatedAt` every 30 seconds, the zombie **never becomes stale** and is **never reaped**.

**This is the critical bug.** It makes zombie runs immortal.

### Bug 2: Startup reaper runs but has no observable effect

**Location:** `server/src/index.ts` ~line 502

The startup reap is called with no staleness threshold (`void heartbeat.reapOrphanedRuns()`), which should reap any run not in `runningProcesses` regardless of age. On a fresh server, `runningProcesses` is empty, so ALL "running"/"queued" runs should be reaped.

**Observed behavior:** No reap log is ever produced at startup, and zombie runs survive restarts. The startup reap either:
- Fails silently (the `.catch()` logs an error that never appears)
- Races with an early DB operation that touches the run first
- Encounters an empty result set because the DB isn't fully warmed

This needs investigation — the startup reap is the primary defense against zombies and it isn't working.

### Bug 3: Zombie runs block new work via maxConcurrentRuns

**Location:** `server/src/services/heartbeat.ts` ~line 1008

`startNextQueuedRunForAgent()` checks `countRunningRunsForAgent()` against `maxConcurrentRuns` (default 1). A zombie "running" run counts against the limit, so new queued runs can never start. They sit in "queued" until the periodic reaper eventually marks them as "process_lost" (if the coalescing in Bug 1 doesn't prevent that too).

**Result:** The agent is permanently bricked. New runs are created, immediately blocked, then reaped — an infinite failure loop.

### Bug 4 (FIXED): pi_local missing from UI isLocal gate

**Location:** `ui/src/components/AgentConfigForm.tsx` ~line 275

`pi_local` was not in the `isLocal` adapter check. The model dropdown, working directory, command field, thinking effort, and bootstrap prompt were all hidden for pi_local agents. Users couldn't set a model, causing "Pi requires `adapterConfig.model` in provider/model format" errors.

**Fix already applied** in this session: added `pi_local` to `isLocal`, set correct command placeholder, model required/groupByProvider, and wired pi's thinking options.

## Reproduction Steps

1. Create a pi_local agent with a valid model (e.g., `anthropic/claude-sonnet-4-20250514`)
2. Assign it an issue or trigger a heartbeat — it starts running
3. Restart the server (`pnpm dev` → Ctrl+C → `pnpm dev`)
4. The run remains "running" in the DB but the child process is dead
5. The timer tick coalesces new wakes into the zombie, refreshing `updatedAt`
6. The periodic reaper never considers it stale
7. The agent is permanently stuck — all new runs fail as "process_lost"

## Acceptance Criteria

1. **Startup reap reliably clears zombie runs.** After a server restart, any run in "queued" or "running" that has no entry in the in-memory `runningProcesses` Map must be reaped before the first timer tick or wakeup request is processed. This must be synchronous (awaited), not fire-and-forget.

2. **Coalescing does not refresh updatedAt on zombie runs.** The coalescing path should check whether the run's process is actually live (exists in `runningProcesses`) before merging context. If the run is not tracked, it should be treated as dead.

3. **Periodic reaper uses process liveness for untracked runs.** The periodic reaper should treat `runningProcesses.has(run.id)` as authoritative — tracked runs are always live. For untracked runs, the existing staleness threshold determines when to reap. The critical fix is preventing coalescing from refreshing `updatedAt` on zombies, which lets the existing staleness logic work correctly.

4. **The UI fix for pi_local is retained.** Model dropdown, working directory, thinking effort, and command placeholder all visible for pi_local adapter.

5. **No manual intervention required after a server restart.** Agents resume normal heartbeat behavior within one timer tick cycle after restart.

## Constraints

- Do not change the heartbeat data model (no new columns or tables)
- Fix must work for all local adapters, not just pi_local (the zombie reaper bug affects any adapter whose child process can be orphaned)
- Startup reap must complete before any timer tick or wakeup is processed
- The fix should not break coalescing for legitimately running processes

## Out of Scope

- Agent JWT missing warning (separate config issue, resolved by running `pnpm paperclipai onboard`)
- The `~/dev/groovejones` tilde-in-path error for the Groove Jones claude_local agent (separate bug, needs `~` expansion in cwd resolution)
- Pi adapter RPC protocol issues
- Budget/cost tracking accuracy

## Evidence

### Zombie run example

Run `b93a2fba` (Founding Engineer, timer):
- Created: `2026-03-11T10:27:14` on previous server instance
- Status: `running` (still, after server restart at 10:32:46)
- startedAt: set (process did start on the old server)
- Events: 2 total, last at `10:27:17` — no activity for 20+ min
- `updatedAt`: continuously refreshed by timer coalescing (observed refreshing every ~30s)
- No `pi` child process exists (`ps aux | grep pi` shows only terminal sessions)

### Queued-then-reaped run example

Run `3daf1a5c` (Founding Engineer, assignment):
- Created: `2026-03-11T10:33:03` on the CURRENT server (16s after start)
- Status: `failed` (process_lost)
- startedAt: `null` — was never executed
- Reaped at `10:38:14` (5 min later by periodic reaper)
- Root cause: zombie run `b93a2fba` occupied the maxConcurrentRuns=1 slot

### Log evidence

- No "startup reap" or "reaped orphaned" log entries after server start at `10:32:47`
- Timer ticks show `enqueued: 1` but runs never start for blocked agents
- `updatedAt` on zombie runs refreshed continuously by coalescing
