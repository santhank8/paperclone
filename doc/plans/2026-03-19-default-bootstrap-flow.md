# Default Bootstrap Flow

Date: 2026-03-19
Related issue: `YEO-2`

## Objective

Document the default path from a fresh Paperclip instance to a functioning CEO and first engineer, and record the remaining/manual edges in that flow.

## Current happy path

### 1. Instance bootstrap

1. Run `pnpm paperclipai run` for first-time local setup.
2. Paperclip creates config if missing, runs doctor, and starts the server.
3. In `authenticated` mode, generate or consume the bootstrap CEO invite.

### 2. Board onboarding

1. Open the board and complete the onboarding wizard.
2. Create the first company and optional company goal.
3. Create the first agent as the CEO.
4. Launch the default CEO issue from the wizard.

### 3. First CEO run

1. The wizard creates a `todo` issue assigned to the CEO.
2. Assignment wakeup triggers the first CEO heartbeat.
3. If no project/session workspace exists yet, the run falls back to the agent-home workspace at:
   - `~/.paperclip/instances/<instance-id>/workspaces/<agent-id>`
4. That agent-home workspace is scaffolded with:
   - `AGENTS.md`
   - `.omx/notepad.md`
   - `.omx/project-memory.json`
   - `.omx/{logs,plans,state}/`
5. For local instruction-file adapters (`claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `pi_local`, `cursor`), Paperclip now defaults `instructionsFilePath` to the agent-home `AGENTS.md`.

### 4. First engineer handoff

1. The CEO uses the onboarding issue to establish its own durable instructions.
2. The CEO hires the Founding Engineer through normal Paperclip hiring flows.
3. The Founding Engineer receives work through standard issue assignment and the same agent-home fallback conventions.

## Rough edge removed in this pass

- New local agents no longer require a separate board-side instructions-path patch before they can persist durable agent instructions. The default path now points at the agent-home `AGENTS.md`.

## Remaining rough edges

- `process` and `http` adapters still require adapter-specific instruction conventions; they do not participate in the default `instructionsFilePath` behavior.
- `authenticated` bootstrap still depends on invite handling and deployment reachability being correct; this is documented but not fully in-app automated.
- The default CEO issue still relies on the CEO to write high-quality role instructions; Paperclip now provides the durable location automatically, but not the final persona content.
