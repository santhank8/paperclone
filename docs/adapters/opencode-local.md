---
title: OpenCode Local
summary: Run OpenCode CLI locally with resumable Paperclip heartbeats
---

`opencode_local` runs the OpenCode CLI on the same machine as Paperclip and resumes work across heartbeats with OpenCode sessions.

## How it works

On each heartbeat, Paperclip runs OpenCode in non-interactive mode:

```sh
opencode run --format json --model <provider/model>
```

If a prior OpenCode session exists for the same working directory, Paperclip resumes it with `--session <id>`. This matches OpenCode's documented CLI flow for scripted runs and keeps Paperclip's heartbeat model simple: each heartbeat is a bounded `run`, not a permanently managed daemon.

## Why Paperclip uses `run` instead of `serve`

OpenCode also documents a headless server (`opencode serve`) and SDK for programmatic control. That is useful for long-lived integrations, but Paperclip heartbeats are discrete scheduled/on-demand runs with their own timeout, audit trail, and run lifecycle. Using `opencode run --format json --session` fits that execution model directly and avoids adding a second persistent local service that Paperclip would need to supervise.

## Skill discovery

Paperclip installs or injects skills into OpenCode's native global skills directory:

- `~/.config/opencode/skills`
- or `$OPENCODE_CONFIG_DIR/skills` when `OPENCODE_CONFIG_DIR` is set

This follows the OpenCode docs for global skill discovery. You can bootstrap a local OpenCode agent identity with:

```sh
pnpm paperclipai agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

That command creates an agent API key, installs Paperclip skills for local coding runtimes, and prints the required `PAPERCLIP_*` exports for launching OpenCode manually.

## Required config

- `adapterType`: `opencode_local`
- `adapterConfig.model`: explicit OpenCode model in `provider/model` format, for example `anthropic/claude-sonnet-4-5`

Optional fields include:

- `cwd`
- `instructionsFilePath`
- `promptTemplate`
- `command`
- `extraArgs`
- `env`
- `variant`

Paperclip validates the configured model against `opencode models` before saving the agent config.

## Heartbeat control notes

- Liveness for the adapter process comes from the Paperclip heartbeat run itself.
- Session continuity comes from OpenCode's `--session` support.
- If OpenCode reports an unknown or missing session, Paperclip clears the stale session and retries with a fresh one.
- For manual external automation beyond Paperclip's heartbeat loop, OpenCode's documented `/global/health` endpoint and SDK remain the best fit.
