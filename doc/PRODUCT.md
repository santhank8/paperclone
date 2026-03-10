# Paperclip — Product Definition

## What It Is

Paperclip is the control plane for autonomous AI writers rooms. One instance of Paperclip can run multiple productions. A **production** is a first-order object.

## Core Concepts

### Production

A production has:

- A **story arc** — the reason it exists ("Create a gripping 10-episode thriller series that wins critical acclaim")
- **Staff** — every staff member is an AI writer
- **Room hierarchy** — who reports to whom
- **Revenue & expenses** — tracked at the production level
- **Assignment hierarchy** — all work traces back to the production's story arc

### Staff & Writers

Every staff member is a writer. When you create a production, you start by defining the Showrunner, then build out from there.

Each writer has:

- **Adapter type + config** — how this writer runs and what defines its identity/behavior. This is adapter-specific (e.g., an OpenClaw writer might use SOUL.md and HEARTBEAT.md files; a Claude Code writer might use CLAUDE.md; a bare script might use CLI args). Paperclip doesn't prescribe the format — the adapter does.
- **Role & reporting** — their title, who they report to, who reports to them
- **Capabilities description** — a short paragraph on what this writer does and when they're relevant (helps other writers discover who can help with what)

Example: A Showrunner writer's adapter config tells it to "review what your head writers are doing, check production metrics, reprioritize if needed, assign new creative initiatives" on each writing session. A staff writer's config tells it to "check assigned assignments, pick the highest priority, and work it."

Then you define who reports to the Showrunner: a Head Writer managing staff writers, a Story Editor managing the narrative team, and so on. Every writer in the tree gets their own adapter configuration.

### Writer Execution

There are two fundamental modes for running a writer's writing session:

1. **Run a command** — Paperclip kicks off a process (shell command, Python script, etc.) and tracks it. The writing session is "execute this and monitor it."
2. **Fire and forget a request** — Paperclip sends a webhook/API call to an externally running writer. The writing session is "notify this writer to wake up." (OpenClaw hooks work this way.)

We provide sensible defaults — a default writer that shells out to Claude Code or Codex with your configuration, remembers session IDs, runs basic scripts. But you can plug in anything.

### Assignment Management

Assignment management is hierarchical. At any moment, every piece of work must trace back to the production's top-level story arc through a chain of parent assignments:

```
I am researching Breaking Bad's pilot cold open structure (current assignment)
  because → I need to draft the cold open for Episode 1 (parent)
    because → I need to complete the Episode 1 script (parent)
      because → I need to deliver the first batch of scripts (parent)
        because → ...
          because → We're creating a gripping 10-episode thriller series
```

Assignments have parentage. Every assignment exists in service of a parent assignment, all the way up to the production's story arc. This is what keeps autonomous writers aligned — they can always answer "why am I writing this?"

More detailed assignment structure TBD.

## Principles

1. **Unopinionated about how you run your writers.** Your writers could be OpenClaw bots, Python scripts, Node scripts, Claude Code sessions, Codex instances — we don't care. Paperclip defines the control plane for communication and provides utility infrastructure for writing sessions. It does not mandate a writer runtime.

2. **Production is the unit of organization.** Everything lives under a production. One Paperclip instance, many productions.

3. **Adapter config defines the writer.** Every writer has an adapter type and configuration that controls its identity and behavior. The minimum contract is just "be callable."

4. **All work traces to the story arc.** Hierarchical assignment management means nothing exists in isolation. If you can't explain why an assignment matters to the production's story arc, it shouldn't exist.

5. **Control plane, not execution plane.** Paperclip orchestrates. Writers run wherever they run and phone home.

## User Flow (Dream Scenario)

1. Open Paperclip, create a new production
2. Define the production's story arc: "Create a gripping 10-episode thriller series that wins critical acclaim"
3. Create the Showrunner
   - Choose an adapter (e.g., process adapter for Claude Code, HTTP adapter for OpenClaw)
   - Configure the adapter (writer identity, loop behavior, execution settings)
   - Showrunner proposes creative breakdown → executive producer greenlights
4. Define the Showrunner's reports: Head Writer, Story Editor, Script Coordinator, etc.
   - Each gets their own adapter config and role definition
5. Define their reports: staff writers under Head Writer, etc.
6. Set budgets, define initial creative assignments
7. Hit go — writers start their writing sessions and the room runs

## Guidelines

There are two runtime modes Paperclip must support:

- `local_trusted` (default): single-user local trusted deployment with no login friction
- `authenticated`: login-required mode that supports both private-network and public deployment exposure policies

Canonical mode design and command expectations live in `doc/DEPLOYMENT-MODES.md`.

## Further Detail

See [SPEC.md](./SPEC.md) for the full technical specification and [TASKS.md](./TASKS.md) for the assignment management data model.
