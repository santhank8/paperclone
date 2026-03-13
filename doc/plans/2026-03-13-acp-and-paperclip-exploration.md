# ACP and Paperclip Exploration

Date: 2026-03-13

## Executive Summary

Short answer: **yes, probably at the adapter layer; no, probably not as Paperclip's main external protocol.**

ACP looks useful for Paperclip when the problem is:

- "How do we talk to coding agents in a standard way?"
- "How do we reduce bespoke adapter work for tools that already speak ACP?"
- "How do we avoid PTY scraping when structured session/tool events exist?"

ACP does **not** look like the right abstraction for:

- Paperclip's company/task/approval/budget API
- Paperclip's board UI contract
- replacing Paperclip's issue/comment heartbeat protocol
- replacing OpenClaw Gateway as the main Paperclip <-> OpenClaw integration surface

My recommendation is:

1. **Do not expose Paperclip itself as an ACP server/agent right now.**
2. **Do consider an experimental ACP-backed adapter** for compatible coding agents.
3. **Treat ACP as an execution-runtime protocol**, not a control-plane protocol.
4. **Let OpenClaw use ACP internally if it wants to**; Paperclip can stay decoupled and keep talking to OpenClaw over Gateway.

## What ACP Is

ACP is an open protocol for communication between **code editors/IDEs and coding agents**, not a general company-orchestration protocol. The docs explicitly position it as standardizing communication between editors and coding agents across local and remote scenarios. It is JSON-RPC based, session-oriented, and capability-driven.

In practice ACP gives you:

- connection/init + optional auth
- `session/new` and `session/load`
- prompt turns within a session
- streaming `session/update` events
- structured tool-call events
- permission requests
- optional client capabilities like filesystem reads/writes and terminal execution

The current protocol strongly prefers `stdio` transport today. Streamable HTTP is still draft/in progress, and custom transports are allowed.

That means ACP is best understood as:

- a **runtime/session protocol**
- for **interactive coding agents**
- usually with a **client** that can offer filesystem/terminal/editor capabilities

It is **not** a built-in model for:

- tasks
- org charts
- assignees
- approvals
- budgets
- company scoping
- audit/activity logs

## What `acpx` Is

`acpx` is a headless CLI client for ACP sessions. Its pitch is that orchestrators can talk to coding agents over a structured protocol instead of scraping PTY output. That is directionally attractive for Paperclip.

However:

- `acpx` is currently marked **alpha**
- its CLI/runtime interfaces are explicitly described as likely to change
- OpenClaw's ACP support currently treats `acpx` as a backend/plugin layer, with built-in harness aliases like `claude`, `codex`, `opencode`, `gemini`, and `pi`

The other important detail is permissions: OpenClaw's ACP docs are explicit that ACP sessions are non-interactive and there is no TTY for permission prompts. If writes/execs need approval and the backend is configured to fail in non-interactive mode, sessions can abort. That matters a lot for Paperclip because Paperclip heartbeat runs are also non-interactive.

## What Paperclip Is Today

Per the repo docs, Paperclip is a **control plane**, not an execution plane:

- agents run externally
- adapters bridge Paperclip to those runtimes
- the durable work model is **issues/comments/tasks**, not chat threads
- V1 invariants include company scoping, atomic checkout, approvals, budget enforcement, and activity logging

The current adapter system is already fairly mature:

- adapter packages live under `packages/adapters/*`
- there are separate server/UI/CLI registries
- the server-side adapter contract already supports:
  - structured execution context
  - session persistence via `sessionParams`
  - environment testing
  - log streaming
  - provider/model/cost reporting
  - local-agent JWT support

Relevant current adapters include:

- local CLI adapters like `claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `pi_local`
- generic `process` and `http`
- `openclaw_gateway`

That matters because ACP is not filling a blank space. It would be joining an existing adapter architecture.

## Fit Analysis

## 1. Should Paperclip use ACP for adapters?

**Yes, potentially.**

This is the cleanest place ACP fits.

Paperclip adapter runs already need the same core primitives ACP provides:

- create or resume a session
- point the runtime at a workspace/cwd
- stream structured progress
- preserve session continuity across heartbeats
- surface tool activity in UI/CLI

There is a straightforward mapping:

| Paperclip concept | ACP concept |
|---|---|
| heartbeat run | prompt turn in a session |
| `runtime.sessionParams` | ACP `sessionId` + selected config state |
| resolved workspace cwd | `session/new.params.cwd` |
| adapter transcript events | `session/update` events |
| run summary/tool activity | ACP tool calls and content blocks |

ACP also lines up with several places where Paperclip already has adapter-specific logic:

- session persistence
- workspace-aware execution
- transcript rendering
- mode/model selection
- permissions/sandbox controls

So if a target runtime already speaks ACP, Paperclip should prefer an ACP-backed adapter over inventing another bespoke adapter protocol.

## 2. Should ACP replace existing local adapters?

**Not broadly, not now.**

For current Paperclip adapters, the native integrations still have real value:

- direct environment tests
- provider-specific session recovery
- provider-specific config surfaces
- tight control over prompt construction and skills injection
- fewer moving parts than "Paperclip -> acpx -> harness -> agent"

ACP is most attractive when it removes bespoke integration work. It is less attractive when it adds another abstraction layer on top of adapters that are already working well.

So the likely rule is:

- **new ACP-native runtimes:** prefer ACP-backed adapter
- **existing stable native adapters:** keep them native unless ACP becomes clearly better

## 3. Should Paperclip expose itself via ACP?

**Probably no.**

This is the wrong abstraction boundary for Paperclip right now.

Paperclip's core value is governance and orchestration:

- company scope
- org structure
- tasks/issues/comments
- approvals
- budgets/costs
- audit logs
- board intervention

ACP does not model those things. It models a client talking to a coding agent in a session.

If Paperclip exposed itself via ACP, one of two things would happen:

1. we would flatten Paperclip into a chat/session abstraction and lose important semantics, or
2. we would add a large number of Paperclip-specific ACP extensions/custom methods and lose most of the interoperability benefit

Either way, it is a poor primary API choice for the control plane.

## 4. Should Paperclip expose agents via ACP?

**Only in a narrow, future-facing sense, and not first.**

A possible future idea would be letting external ACP clients attach to a Paperclip-managed coding session. But that is a different product from Paperclip's current heartbeat/task-driven model, and it pushes the product toward chat/session-first behavior that the current docs explicitly avoid.

So this should be treated as:

- maybe useful later for a special "external live session" feature
- not a foundation for the current product

## OpenClaw-Specific Answer

Paperclip already has a strong OpenClaw integration shape: `openclaw_gateway`.

That is important because OpenClaw's ACP support appears to be an **OpenClaw backend/runtime choice**, not evidence that every OpenClaw integrator should switch to ACP directly.

In other words:

- OpenClaw can use `acpx` internally
- Paperclip can continue talking to OpenClaw over Gateway
- those are compatible decisions

This is probably the right decoupling.

Paperclip should not rush to replace Gateway with ACP unless there is a specific problem Gateway cannot solve. Right now Gateway already gives Paperclip what it needs:

- wake a remote runtime
- track a run
- stream events/logs
- preserve session identity

If OpenClaw gets meaningfully better because it uses ACP under the hood, Paperclip benefits indirectly without needing to absorb ACP complexity itself.

## Recommended Path

## Recommendation A: Do not expose Paperclip as ACP

Keep Paperclip's external/control-plane contract as its own REST + agent-auth model.

Reason:

- that contract is about governance and company-scoped work objects
- ACP is about agent sessions

## Recommendation B: Add an experimental ACP adapter

Build one new adapter, explicitly experimental, for ACP-compatible runtimes.

I would frame it as one of these:

- `acp_stdio`
- `acp_local`
- `acpx_local`

My preference is:

- **short term:** `acpx_local` if the goal is fast validation
- **long term:** `acp_stdio` using an ACP SDK directly if the goal is a stable first-class integration

Reason:

- `acpx` is the fastest path to test value
- `acpx` being alpha makes it a bad foundation if we want long-term stability

## Recommendation C: Keep OpenClaw Gateway

Do not replace `openclaw_gateway` with ACP.

At most, add a note in OpenClaw-related docs that:

- OpenClaw may itself be using ACP/acpx internally
- Paperclip remains gateway-integrated at the control-plane boundary

## Where ACP Could Fit in the Codebase

If we add ACP support, the clean place is a new adapter package:

`packages/adapters/acpx-local/`

or

`packages/adapters/acp-stdio/`

It would follow the existing adapter package structure:

- `src/index.ts`
- `src/server/index.ts`
- `src/server/execute.ts`
- `src/server/test.ts`
- `src/ui/index.ts`
- `src/ui/build-config.ts`
- `src/ui/parse-stdout.ts`
- `src/cli/index.ts`
- `src/cli/format-event.ts`

### Server-side responsibilities

- create/load ACP session
- map Paperclip workspace resolution to ACP `cwd`
- map Paperclip config to ACP config options or modes
- send prompt turn per heartbeat
- translate `session/update` and tool-call events into Paperclip logs/transcript
- persist ACP session identity into `runtime.sessionParams`
- apply non-interactive permission policy explicitly

### UI responsibilities

- render ACP tool calls as transcript entries
- surface ACP config options dynamically when possible
- expose a clear warning when the backend requires permission prompts that cannot succeed non-interactively

### CLI responsibilities

- pretty-print ACP session updates/tool calls
- make it obvious when a run is blocked by permission policy

## Proposed Paperclip-to-ACP Mapping

If implemented, this is the mapping I would use:

### Session state

- store `sessionId` in `runtime.sessionParams`
- also store:
  - `cwd`
  - selected config option values
  - agent alias / harness identity
  - any adapter-specific resume metadata

### Workspace

- map resolved Paperclip workspace to ACP `cwd`
- do **not** assume ACP filesystem methods replace Paperclip's workspace/runtime model

### Prompting

- Paperclip heartbeat remains the outer loop
- each heartbeat sends one ACP prompt turn
- the prompt still tells the agent to follow the Paperclip heartbeat protocol and use Paperclip APIs for tasks/comments/approvals

### Auth

- keep Paperclip auth exactly as it works now:
  - local agent JWT when supported
  - otherwise `PAPERCLIP_API_KEY` / bearer auth
- ACP is only the runtime control channel to the coding agent

### Permissions

- default to an explicit non-interactive policy
- fail fast in environment tests if the selected ACP backend will dead-end on permission prompts
- do not treat ACP permission prompts as a substitute for Paperclip approvals

Paperclip approvals are governance objects.
ACP permissions are runtime tool-execution controls.
Those are related, but they are not the same thing.

## Risks

## Product risks

- ACP pushes mental models toward chat/session-first behavior
- that can conflict with Paperclip's issue/task-first product boundary

## Technical risks

- `acpx` is alpha
- ACP HTTP transport is still draft; `stdio` is the only clearly stable baseline
- non-interactive permission handling is a real operational hazard
- different ACP agents may expose different config options/modes, which can make the UI less uniform

## Integration risks

- wrapping mature native adapters in ACP may increase complexity without enough benefit
- a Paperclip-specific ACP extension story would likely damage interoperability

## Decision

My recommendation is:

1. **Do not make ACP a core Paperclip protocol.**
2. **Do not expose Paperclip itself via ACP right now.**
3. **Do add ACP experimentally at the adapter boundary** if there is real demand for ACP-native runtimes or if adapter maintenance pressure grows.
4. **Keep OpenClaw Gateway as the primary OpenClaw integration surface.**
5. **Treat `acpx` as an experiment, not a foundational dependency**, unless its stability and ecosystem support improve materially.

## Practical Answer to "Should Paperclip be using ACP?"

The answer I would give externally is:

> ACP looks promising for Paperclip as an adapter/runtime integration layer, especially for coding agents that already support ACP. It does not look like the right abstraction for Paperclip's main control-plane API, so we are more likely to support ACP inside adapters than to expose Paperclip itself over ACP.

## Sources

External:

- https://agentclientprotocol.com/get-started/introduction
- https://agentclientprotocol.com/get-started/architecture
- https://agentclientprotocol.com/protocol/overview
- https://agentclientprotocol.com/protocol/session-setup
- https://agentclientprotocol.com/protocol/tool-calls
- https://agentclientprotocol.com/protocol/file-system
- https://agentclientprotocol.com/protocol/terminals
- https://agentclientprotocol.com/protocol/session-config-options
- https://agentclientprotocol.com/protocol/session-modes
- https://agentclientprotocol.com/protocol/transports
- https://docs.openclaw.ai/tools/acp-agents
- https://github.com/agentclientprotocol/agent-client-protocol
- https://github.com/openclaw/acpx

Repo context:

- `doc/GOAL.md`
- `doc/PRODUCT.md`
- `doc/SPEC-implementation.md`
- `doc/DEVELOPING.md`
- `doc/DATABASE.md`
- `docs/adapters/overview.md`
- `docs/adapters/creating-an-adapter.md`
- `docs/guides/agent-developer/heartbeat-protocol.md`
- `packages/adapter-utils/src/types.ts`
- `server/src/adapters/registry.ts`
- `server/src/services/heartbeat.ts`
- `packages/adapters/openclaw-gateway/README.md`
- `packages/adapters/openclaw-gateway/src/server/execute.ts`
- `packages/adapters/codex-local/src/server/execute.ts`
- `packages/adapters/claude-local/src/server/execute.ts`
