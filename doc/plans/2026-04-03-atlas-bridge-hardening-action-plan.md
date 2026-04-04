# Atlas Bridge Hardening Action Plan

## Context

Atlas execution has been iterated on for months, but the current feedback loop is still too expensive and too opaque.

Observed failure patterns keep repeating:

- wrong stand or wrong branch bound to the task
- stand bootstrap fails or returns `504`
- changes are deployed but not visible where the operator expects them
- task pickup / status / verify progress is unclear from Telegram alone
- `Execution Failed` collapses many distinct failure classes into one operator-visible error
- drift between task state, slot state, runtime state, and user-visible status is hard to inspect quickly

The goal of this plan is not to replace Atlas.

The goal is to introduce a hardening and transparency layer through Paperclip so the system becomes cheaper to debug, safer to operate, and easier for Codex and humans to reason about.

## What We Know Today

### Repository and workspace reality

- `/Users/s1z0v/kd-projects/Paperclip` is an operational control-plane workspace, not a git repository.
- The versioned upstream Paperclip checkout lives at `/Users/s1z0v/kd-projects/Paperclip/state/upstream/paperclip`.
- The upstream Paperclip checkout is currently dirty on branch `codex/openclaw-gateway-auth-fix`.
- Atlas lives at `/Users/s1z0v/kd-projects/Homio/atlas` and is currently dirty on branch `codex/atlas-openclaw-delivery-green-20260401`.

This means bridge work must not be spread across those already-dirty branches without a separate canonical development lane.

### Paperclip plugin capabilities already exist

Paperclip already has the primitives needed for an `atlas-bridge` plugin:

- plugin install and upgrade lifecycle
- local-path plugin installs
- plugin worker restart watcher for local development
- plugin state storage
- plugin jobs, webhooks, tools, UI bridge routes, and activity logging

Relevant implementation surfaces:

- `server/src/routes/plugins.ts`
- `server/src/services/plugin-lifecycle.ts`
- `server/src/services/plugin-loader.ts`
- `server/src/services/plugin-dev-watcher.ts`
- `server/src/services/plugin-state-store.ts`
- `server/src/services/plugin-host-services.ts`

### Atlas observe surfaces already exist

Atlas already exposes most of the raw state the bridge needs:

- A2A task status updates
- A2A events
- A2A artifacts
- runtime verify runs
- slot board and slot lock surfaces

Relevant implementation surfaces:

- `scripts/mini-app/server.ts`
- `scripts/runtime/a2a-task-registry.ts`
- `scripts/runtime/task-runtime-registry.ts`

The key design opportunity is to normalize and reconcile these existing surfaces, not rebuild them.

## Goals

1. Give operators and Codex one canonical execution picture per issue.
2. Reduce the debugging loop from "change, deploy, wait 5-10 minutes, discover almost nothing" to "change locally, observe live state immediately, classify failure quickly".
3. Separate infrastructure failures, slot drift, preview lag, verify failures, and transport/handoff failures into explicit classes.
4. Make the Paperclip bridge safe to iterate locally without repeated full live deploy cycles.
5. Preserve work reliably by introducing a canonical repo and release path for the bridge itself.

## Non-Goals

- Replacing Atlas branch/worktree/slot/HMR/verify runtime.
- Re-implementing full execution orchestration inside Paperclip.
- Moving all Atlas services local before the bridge proves value.
- Building tunnel-based remote plugin hosting as a first step.

## Recommendation In One Sentence

Build a versioned `atlas-bridge` plugin and supporting contracts locally, run it against live Atlas in `observe-only` mode first, use Paperclip as the canonical control and transparency plane, and only enable control actions after reconcile/debug surfaces are stable.

## Core Decisions

### 1. Use a hybrid live-local model, not full local and not full online

The bridge should be developed locally with a short feedback loop while reading live Atlas state.

Recommended topology:

- local Paperclip dev host
- local `atlas-bridge` plugin installed from local path
- live Atlas mini-app / A2A / slot-board as the observed execution plane
- live Paperclip untouched until the bridge is stable enough for canary rollout

Why:

- full local does not reproduce real slot drift, live deploy lag, auth edges, or infra failures cheaply
- full online keeps the feedback loop too slow and too costly
- hybrid gives fast plugin iteration while preserving real Atlas conditions

### 2. Do not start with a tunnel into the live Paperclip runtime

Phase 1 should not attempt to make the live Paperclip host execute a local plugin worker over a custom tunnel.

That adds a second transport problem before the bridge itself exists.

Instead:

- run a local Paperclip dev instance
- install the bridge from a local path
- point it at live Atlas using observe-only credentials
- use a tunnel only if the local UI must be shared externally for review

### 3. Keep Atlas as the execution plane

Atlas remains responsible for:

- branch/worktree/workspace binding
- slot allocation and release
- HMR/deploy/sync
- runtime sessions
- verify execution and raw evidence

Paperclip becomes responsible for:

- issue-scoped execution envelope
- state machine
- failure classification
- debug pack generation
- human-readable status and audit trail
- controlled rollout of retry/release/start operations

### 4. Create a separate canonical bridge repository

Because the current Paperclip and Atlas working trees are already dirty and on unrelated branches, the bridge itself should live in a separate repo from the beginning.

Recommended local path:

- `/Users/s1z0v/kd-projects/paperclip-atlas-bridge`

Recommended remote:

- GitLab project such as `homio/paperclip-atlas-bridge`

Recommended contents:

- `packages/atlas-bridge-plugin`
- `packages/atlas-bridge-contracts`
- `docs/`
- `scripts/`
- optional `examples/`

Host changes that must land in Paperclip or Atlas should still be patched in their native repos. The bridge repo is the canonical home for bridge logic and shared contracts.

### 5. Use `observe-only` as the first production mode

The first successful milestone is not "the bridge can start tasks".

The first successful milestone is:

- the bridge can observe live Atlas
- bind issue to task to slot to branch to commit
- collect evidence
- classify failures
- show the operator what is happening without changing execution

Only after that should the bridge gain control actions.

## Product Requirements

### Primary operator outcomes

The operator must be able to:

1. Open a Paperclip issue and immediately see the latest execution envelope.
2. See whether a task was accepted, bound to a slot, deployed, verified, or stalled.
3. Understand the difference between:
   - infra failure
   - binding drift
   - preview visibility lag
   - verify failure
   - transport/handoff failure
4. Open one debug pack and see all evidence needed for a first-pass diagnosis.
5. See live slot occupancy and stale/unhealthy states directly in Paperclip.

### Codex outcomes

Codex must be able to call one stable surface instead of inspecting Atlas manually each time.

Minimum bridge tools:

- `atlas.get_issue_execution_context(issueId)`
- `atlas.get_debug_pack(issueId)`
- `atlas.list_live_slots()`
- `atlas.reconcile_execution(issueId)`
- `atlas.classify_failure(issueId)`
- `atlas.request_verify(issueId)`
- `atlas.release_slot(issueId, action)`

## System Model

### Canonical entities

#### Paperclip issue execution envelope

This is the bridge-owned issue-scoped state machine.

Fields:

- `paperclipIssueId`
- `atlasTaskId`
- `atlasSessionId`
- `slotName`
- `envName`
- `branch`
- `commitSha`
- `executionState`
- `failureClass`
- `lastHeartbeatAt`
- `latestPreviewUrl`
- `latestVerifyVerdict`
- `artifacts`
- `timeline`

#### Atlas raw execution facts

These remain Atlas-owned:

- A2A task
- A2A events
- A2A artifacts
- slot board / slot lock state
- runtime verify runs

### State machine

Recommended bridge states:

- `requested`
- `accepted`
- `slot_bound`
- `deploying`
- `preview_declared`
- `preview_healthy`
- `verify_running`
- `verify_passed`
- `verify_failed`
- `review_pending`
- `done`
- `drift_detected`
- `infra_failed`
- `transport_failed`

No state change should happen without evidence.

Examples:

- `slot_bound` requires task binding plus slot name plus branch
- `preview_declared` requires preview URL and slot binding
- `preview_healthy` requires a successful probe plus a consistent slot/branch binding
- `verify_passed` requires a recorded verify result, not just the absence of errors

## Failure Taxonomy

The bridge should classify failures into explicit buckets.

### 1. `infra_bootstrap_failure`

Examples:

- `504` from stand
- deploy timeout
- registry pull too slow
- runtime startup/OOM
- auth probe or login bootstrap failure

### 2. `slot_binding_drift`

Examples:

- task bound to one slot in task state but another slot in live board
- branch mismatch between task metadata and slot metadata
- duplicate slot occupancy for the same branch/task

### 3. `preview_visibility_lag`

Examples:

- deploy completed but preview not yet healthy
- preview artifact not published yet
- operator-facing preview appears later than the underlying task state

### 4. `verify_pipeline_failure`

Examples:

- verify run failed
- screenshots missing
- acceptance checks failed

### 5. `transport_handoff_failure`

Examples:

- task created but not claimed
- status not propagated back
- callback lost
- Telegram shows final error without intermediate execution picture

### 6. `unknown_execution_failure`

Used only when the bridge cannot classify confidently.

## Debug Pack

Every issue must be able to produce one machine-readable debug pack.

Required sections:

- issue binding
- latest A2A task snapshot
- ordered A2A event timeline
- latest A2A artifacts by kind
- live slot-board snapshot for the bound slot
- slot drift analysis
- preview URL and probe result
- verify runs and latest verdict
- failure classification
- recommended operator next steps

Minimum bindings to include:

- `paperclipIssueId`
- `atlasTaskId`
- `atlasSessionId`
- `slotName`
- `envName`
- `branch`
- `commitSha`

## Repository Strategy

### 1. Paperclip control-plane workspace

Path:

- `/Users/s1z0v/kd-projects/Paperclip`

Role:

- operational notes
- scripts
- backups
- high-level runbooks

Important constraint:

- this workspace is not git

### 2. Paperclip upstream checkout

Path:

- `/Users/s1z0v/kd-projects/Paperclip/state/upstream/paperclip`

Role:

- actual Paperclip host code changes
- Paperclip plugin platform changes
- versioned documentation like this plan

### 3. Atlas repo

Path:

- `/Users/s1z0v/kd-projects/Homio/atlas`

Role:

- Atlas mini-app / A2A / runtime changes

### 4. New bridge repo

Path:

- `/Users/s1z0v/kd-projects/paperclip-atlas-bridge`

Role:

- canonical bridge logic
- shared bridge contracts
- plugin source
- local dev harness
- bridge release automation

## Development Topology

### Phase-1 topology

- local Paperclip dev host
- local bridge plugin from local path
- live Atlas mini-app
- live Atlas slots
- live Atlas verify pipeline
- Paperclip plugin in `observe-only`

### Optional tunnel usage

Tunnel is optional and should be used only for:

- sharing the local Paperclip bridge UI externally
- allowing remote browser access to a local Paperclip dev page

Tunnel is not the primary plugin runtime model.

## Paperclip Plugin Design

### Required capabilities

Minimum expected plugin capabilities:

- `issues.read`
- `issues.update`
- `issue-comments.create`
- `activity.log.write`
- `plugin.state.read`
- `plugin.state.write`
- `events.subscribe`
- `jobs.schedule`
- `webhooks.receive`
- `http.outbound`
- relevant UI capabilities for issue and dashboard surfaces

### Storage model

Machine state:

- keep in plugin state storage

Human-readable projection:

- issue document or work product summary

Operational timeline:

- activity log

Why:

- issue documents are not the right primary hot state surface for rapidly changing machine state
- plugin state gives a better canonical store for reconcile and resumption

### UI surfaces

Minimum UI surfaces:

- issue execution panel
- issue debug pack panel
- slot board widget
- optional bridge admin/settings page

## Atlas Integration Design

### Observe surfaces to use first

- `GET /api/slot-board`
- `GET /api/slots`
- `GET /api/a2a/tasks/:id`
- `GET /api/a2a/tasks/:id/events`
- `GET /api/a2a/tasks/:id/artifacts`
- `POST /api/runtime/verify-runs` consumption on Atlas side, read via runtime/registry surfaces as needed

### Control surfaces to enable later

- task creation / start
- verify trigger
- slot release
- retry execution

These should remain feature-flagged until observe and reconcile are stable.

## Reconcile Model

The bridge must be dual-path:

- push from Atlas callbacks/webhooks
- pull from scheduled reconcile jobs

Rules:

1. Webhook delivery must not be assumed reliable.
2. Reconcile must be able to reconstruct the issue execution envelope from Atlas facts.
3. Any inconsistency between Atlas task and Atlas slot-board surfaces must be surfaced as drift, not hidden.
4. Any execution state older than its SLA window must be reclassified as stale and revisited by reconcile.

## Release Strategy

### Local development

Use:

- local-path plugin install
- plugin dev watcher
- local Paperclip dev instance

This gives the shortest loop for bridge worker/UI logic.

### Live canary

Only after local observe mode is stable:

- install bridge in live Paperclip
- keep it in `observe-only`
- scope it to one repo and one slot pool subset

### Production rollout

Roll out in this order:

1. observe-only
2. reconcile-only
3. verify trigger
4. slot release
5. start/retry execution

## Workstreams

### Workstream A: Repo and branch hygiene

Deliverables:

- canonical bridge repo created
- branch policy documented
- release path documented
- no bridge logic living only in dirty ad hoc branches

### Workstream B: Shared contracts

Deliverables:

- failure taxonomy
- debug-pack schema
- issue execution envelope schema
- Atlas callback payload schema

### Workstream C: Atlas observer facade

Deliverables:

- normalized Atlas client
- slot-board reader
- A2A reader
- evidence assembler
- canary scope configuration

### Workstream D: Paperclip bridge plugin skeleton

Deliverables:

- plugin manifest
- plugin state store model
- scheduled reconcile job
- webhook receiver
- issue tool surface

### Workstream E: UI and operator surfaces

Deliverables:

- issue execution panel
- debug pack view
- slot board widget
- failure badges

### Workstream F: Canary rollout and controls

Deliverables:

- observe-only deployment
- canary repo/slot allowlists
- feature flags for control actions
- first controlled retry/release actions

## Implementation Phases

## Phase 0: Baseline and safety

1. Create the canonical bridge repo.
2. Snapshot current Paperclip and Atlas dirty working trees so nothing is lost.
3. Document which changes belong in:
   - bridge repo
   - Paperclip upstream repo
   - Atlas repo
4. Do not start implementation until ownership boundaries are explicit.

## Phase 1: Observe-only bridge

1. Implement shared contracts.
2. Implement Atlas observer client.
3. Implement Paperclip plugin skeleton.
4. Render issue execution envelope from live Atlas.
5. Render slot board in Paperclip.
6. Generate debug packs.

Success criteria:

- zero execution control actions
- issue execution view works against live Atlas
- major failure classes are distinguishable

## Phase 2: Reconcile and classification

1. Add scheduled reconcile job.
2. Add stale execution detection.
3. Add drift detection.
4. Add failure classification rules.
5. Add recommended next actions to debug packs.

Success criteria:

- webhook loss does not break the operator picture
- stale issues are surfaced explicitly
- drift is visible without manual DB inspection

## Phase 3: Canary control

1. Add verify trigger action.
2. Add slot release action.
3. Restrict by feature flags:
   - allowed repos
   - allowed slots
   - allowed actions
4. Canary on one repo and one slot pool subset.

Success criteria:

- control actions are safe and auditable
- no accidental global rollout

## Phase 4: Execution control

1. Add start/retry execution paths.
2. Keep Atlas as the execution runtime.
3. Use the bridge as the orchestration and transparency layer.

Success criteria:

- issue-driven control loop runs through Paperclip
- operator still has full debug visibility

## Checklists

### Baseline checklist

- [ ] confirm canonical bridge repo location
- [ ] snapshot current dirty branches in Paperclip upstream and Atlas
- [ ] record remotes and active branches
- [ ] agree on feature-flag names for canary rollout

### Observe-only checklist

- [ ] shared contracts package exists
- [ ] Atlas observer client can read slot board
- [ ] Atlas observer client can read A2A status/events/artifacts
- [ ] Paperclip plugin can store issue execution envelope
- [ ] issue execution panel renders
- [ ] debug pack renders
- [ ] no write/control actions enabled

### Reconcile checklist

- [ ] scheduled reconcile job exists
- [ ] lost webhook scenario is recoverable
- [ ] stale execution SLA is enforced
- [ ] drift detection is visible in UI and debug pack
- [ ] failure classification populates consistently

### Canary control checklist

- [ ] allowlist for repo scope exists
- [ ] allowlist for slot scope exists
- [ ] verify trigger is feature-flagged
- [ ] slot release is feature-flagged
- [ ] operator audit trail is recorded

### Production readiness checklist

- [ ] bridge can survive Paperclip restart
- [ ] bridge can survive lost Atlas callback
- [ ] bridge does not require tunnel for normal operation
- [ ] bridge release path is documented and repeatable
- [ ] Codex tools return enough context for first-pass diagnosis

## Immediate Next Actions

1. Create the canonical `paperclip-atlas-bridge` repo locally and remotely.
2. Move bridge-specific logic out of ad hoc Paperclip and Atlas working branches.
3. Scaffold:
   - `packages/atlas-bridge-contracts`
   - `packages/atlas-bridge-plugin`
4. Implement read-only Atlas client against:
   - slot board
   - A2A task status
   - A2A events
   - A2A artifacts
5. Install the plugin locally into a Paperclip dev instance from local path.
6. Keep the live Paperclip host untouched until observe-only mode is proven.

## Open Questions

1. Which exact Paperclip dev environment should be used as the primary local bridge host?
2. Which repo and slot should be the first canary target?
3. Which credentials source should be used for the bridge in local observe-only mode?
4. Do we want the shared contracts package to be fully separate, or colocated inside the bridge repo as a workspace package?

## Acceptance Criteria

1. A human or Codex can open a single Paperclip issue and immediately understand the current execution state without digging through Telegram and Atlas manually.
2. The bridge can distinguish infra, drift, preview, verify, and transport failures.
3. The first rollout path works with a short local feedback loop and without repeated full live deploy cycles for every bridge change.
4. Bridge code has a canonical repo and release path, so work is not lost across dirty branches and parallel agents.
5. Control actions are enabled only after observe and reconcile are already stable.
