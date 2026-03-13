# Investigation: Workspace reporting mismatch between heartbeat and local adapters

## Summary
Heartbeat and the local adapters are describing two different things. Heartbeat records and logs the **server-selected workspace** (`paperclipWorkspace.cwd`), while local adapters like Codex and Pi may intentionally execute in `adapterConfig.cwd` when `paperclipWorkspace.source === "agent_home"`. The result is a misleading warning, not usually a wrong execution cwd. The `issue_assigned` session-reset log is expected behavior, but its wording is too terse and compounds the confusion.

## Symptoms
- Heartbeat logs: `No project or prior session workspace was available. Using fallback workspace ".../.paperclip/..." for this run.`
- Heartbeat logs: `Skipping saved session resume for task "..." because wake reason is issue_assigned.`
- User observed Pi executing in the real project folder despite the fallback warning.
- Codex and Pi share the same adapter-side `agent_home` override behavior.

## Investigation Log

### Phase 1 - Reset/session behavior
**Hypothesis:** `issue_assigned` is intentionally treated as a fresh task-session boundary, so that log line is expected and separate from the workspace warning.

**Findings:** Heartbeat deliberately resets task session reuse on assignment wakes.

**Evidence:**
- `server/src/services/heartbeat.ts:246-256`
  - `shouldResetTaskSessionForWake()` returns `true` when `wakeReason === "issue_assigned"`.
- `server/src/services/heartbeat.ts:259-272`
  - `describeSessionResetReason()` maps that to the text `wake reason is issue_assigned`.
- `server/src/services/heartbeat.ts:1231-1240`
  - heartbeat appends `Skipping saved session resume for task "..." because ${sessionResetReason}.`
- `server/src/routes/issues.ts:446-456`
  - issue create wakes the assignee with `reason: "issue_assigned"`.
- `server/src/routes/issues.ts:591-600`
  - issue reassignment/update also wakes with `reason: "issue_assigned"`.

**Conclusion:** Confirmed. The session-reset line is intentional and not the root bug, though the wording is not very explanatory.

### Phase 2 - Heartbeat workspace resolution
**Hypothesis:** Heartbeat logs the fallback workspace without considering that the adapter may execute elsewhere.

**Findings:** `resolveWorkspaceForRun()` only reasons about project workspace rows, prior session cwd, and the fallback agent-home directory. It has no awareness of adapter `config.cwd`.

**Evidence:**
- `server/src/services/heartbeat.ts:530-669`
  - `resolveWorkspaceForRun()` returns either:
    - project workspace (`source: "project_primary"`),
    - session workspace (`source: "task_session"`), or
    - fallback agent-home workspace (`source: "agent_home"`).
- `server/src/services/heartbeat.ts:651-658`
  - when neither project workspace nor prior session workspace is usable, it emits:
    - `Saved session workspace "..." is not available. Using fallback workspace "..." for this run.`
    - `No project workspace directory is currently available for this issue. Using fallback workspace "..." for this run.`
    - `No project or prior session workspace was available. Using fallback workspace "..." for this run.`
- `server/src/services/heartbeat.ts:1241-1245`
  - heartbeat writes `context.paperclipWorkspace = { cwd: executionWorkspace.cwd, source: executionWorkspace.source, ... }`, preserving the server-side workspace selection.

**Conclusion:** Confirmed. Heartbeat is logging the server-selected workspace record, not the adapter's effective cwd.

### Phase 3 - Local adapter execution behavior
**Hypothesis:** Local adapters intentionally override fallback `agent_home` with `config.cwd`, causing the reporting mismatch.

**Findings:** Codex and Pi both intentionally use `config.cwd` when the workspace source is `agent_home`, and they suppress `PAPERCLIP_WORKSPACE_CWD` in that case.

**Evidence:**
- `packages/adapters/codex-local/src/server/execute.ts:159-162`
  - `useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0`
  - `const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd()`
- `packages/adapters/codex-local/src/server/execute.ts:211-215`
  - only exports `PAPERCLIP_WORKSPACE_CWD` when `effectiveWorkspaceCwd` is non-empty.
- `packages/adapters/pi-local/src/server/execute.ts:138-141`
  - same `agent_home + configured cwd` override logic.
- `packages/adapters/pi-local/src/server/execute.ts:187-193`
  - same omission of `PAPERCLIP_WORKSPACE_CWD` when using configured cwd instead of `agent_home`.

**Conclusion:** Confirmed. Adapter behavior is intentionally different from the raw heartbeat fallback workspace record.

### Phase 4 - Cross-adapter contract and metadata
**Hypothesis:** This override behavior is already part of the expected local-adapter contract, and there is already metadata to describe the real execution cwd.

**Findings:** The local-adapter contract tests explicitly codify this override. Adapter invocation metadata already has `cwd` and `commandNotes`, and the UI already renders both.

**Evidence:**
- `packages/adapter-utils/src/local-execute-contract-test.ts:93-114`
  - test name: `uses configured cwd instead of agent_home fallback without exporting fallback workspace cwd`
  - asserts `runOpts.cwd === configuredCwd`
  - asserts `runOpts.env.PAPERCLIP_WORKSPACE_SOURCE === "agent_home"`
  - asserts `runOpts.env.PAPERCLIP_WORKSPACE_CWD === undefined`
- `packages/adapter-utils/src/types.ts:94-101`
  - `AdapterInvocationMeta` already supports:
    - `cwd?: string`
    - `commandNotes?: string[]`
- `server/src/services/heartbeat.ts:1430-1441`
  - heartbeat persists adapter metadata via `adapter.invoke` run events.
- `ui/src/pages/AgentDetail.tsx:2058-2090`
  - UI already displays invocation `Working dir` from `adapterInvokePayload.cwd`
  - UI already displays `Command notes` from `adapterInvokePayload.commandNotes`

**Conclusion:** Confirmed. The adapter-side effective cwd already has a proper reporting channel; the mismatch is that heartbeat warnings do not use it.

## Root Cause
The root cause is a **cross-layer reporting mismatch**:

1. Heartbeat selects and records a server-side workspace in `paperclipWorkspace` (`server/src/services/heartbeat.ts:530-669`, `1241-1245`).
2. For local adapters, `agent_home` is only a bookkeeping fallback when `config.cwd` exists; the adapter process intentionally runs in `config.cwd` instead (`packages/adapters/codex-local/src/server/execute.ts:159-162`, `packages/adapters/pi-local/src/server/execute.ts:138-141`).
3. The shared local-adapter tests now explicitly encode that behavior as correct (`packages/adapter-utils/src/local-execute-contract-test.ts:93-114`).
4. Heartbeat warnings still say `Using fallback workspace ...`, which is true about the server-selected workspace record but misleading about the actual process cwd.
5. The `issue_assigned` reset message is expected, but the plain wording (`wake reason is issue_assigned`) makes the whole sequence read like a failure rather than intentional fresh-session behavior.

## Eliminated Hypotheses
- **"Pi alone is broken"** — eliminated. Codex and Pi share the same `agent_home + configured cwd` logic (`codex-local` and `pi-local` execute files cited above).
- **"The issue_assigned reset line is the bug"** — eliminated. That reset is explicitly intended in heartbeat and triggered by issue routes (`heartbeat.ts:246-256`, `routes/issues.ts:446-456`, `591-600`).
- **"paperclipWorkspace.cwd should always equal actual adapter cwd"** — eliminated as the current design. Existing adapter contract tests intentionally allow them to differ when `source === "agent_home"`.

## Recommendations
1. **Adopt a medium-risk reporting fix, not an execution change.**
   - Keep current local-adapter cwd behavior.
   - Do not change the semantics of `paperclipWorkspace.cwd` in this change.

2. **Fix heartbeat warning text in `server/src/services/heartbeat.ts`.**
   - When heartbeat falls back to `agent_home` and the local adapter has `config.cwd`, say that:
     - fallback agent-home workspace was recorded, **but**
     - the local adapter will execute in configured cwd `...`
   - This should replace the current unconditional `Using fallback workspace ...` wording in the `agent_home` branch (`server/src/services/heartbeat.ts:651-658`).

3. **Make session-reset wording explicit in `server/src/services/heartbeat.ts`.**
   - Update `describeSessionResetReason()` (`server/src/services/heartbeat.ts:259-272`) so `issue_assigned` reads as an intentional fresh-task boundary, for example:
     - `wake reason is "issue_assigned" (assignment wakes start a fresh task session)`
   - This will make the existing `Skipping saved session resume ...` log (`server/src/services/heartbeat.ts:1235-1239`) clearer.

4. **Use existing adapter metadata more deliberately.**
   - Add `commandNotes` in each local adapter execute implementation when `config.cwd` overrides `agent_home`.
   - Example note:
     - `Using configured cwd "/path/to/repo" instead of fallback agent_home workspace "/Users/.../.paperclip/...".`
   - This can be surfaced immediately because the UI already renders `commandNotes` and `cwd`.

5. **Factor the local adapter cwd resolution into a shared helper.**
   - Current logic is duplicated across local adapters.
   - A shared helper in `packages/adapter-utils` would reduce drift and make the reporting note reusable.

## Preventive Measures
- Extend the shared local execute contract test to also assert `onMeta.cwd` and a `commandNotes` override explanation when `agent_home` is overridden by configured cwd.
- Add heartbeat-focused tests for the fallback-warning formatter so the message stays aligned with actual local-adapter behavior.
- Keep `paperclipWorkspace` as the server-selected workspace contract and `AdapterInvocationMeta.cwd` as the authoritative actual process cwd for local adapters.
