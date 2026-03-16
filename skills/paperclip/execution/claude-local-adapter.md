---
title: Claude Local Adapter
description: claude_local adapter — spawns Claude CLI subprocess, parses JSON output, persists sessions and token usage
type: pattern
links: [adapter-protocol, session-resume, prompt-templates]
---

# Claude Local Adapter

The `claude_local` adapter is the primary built-in for running agents. It spawns the local `claude` CLI as a subprocess, parses its JSON output, and persists session state for resume.

## Config Shape

```json
{
  "cwd": "/absolute/path/to/workspace",
  "promptTemplate": "You are agent {{agent.id}} ...",
  "model": "optional-model-id",
  "maxTurnsPerRun": 300,
  "dangerouslySkipPermissions": true,
  "instructionsFilePath": "agents/ceo/AGENTS.md",
  "env": { "KEY": "VALUE" },
  "extraArgs": [],
  "timeoutSec": 1800,
  "graceSec": 20
}
```

## Invocation

Base command: `claude --print <prompt> --output-format json`

Flags added conditionally:
- `--resume <sessionId>` when [[session-resume]] state has a session ID for the current task
- `--dangerously-skip-permissions` when enabled in config
- `--model <model>` when specified
- `--append-system-prompt-file <path>` for `instructionsFilePath`
- `--max-turns <n>` for turn limit

## Output Parsing

1. Parse stdout as JSON object
2. Extract `session_id` for [[session-resume]]
3. Extract usage: `usage.input_tokens`, `usage.cache_read_input_tokens`, `usage.output_tokens`
4. Extract `total_cost_usd` when present
5. On non-zero exit: still attempt parse — if parse succeeds, keep extracted state and mark run failed unless adapter explicitly reports success

## Process Handling

The adapter follows common local adapter rules:

- `spawn(command, args, { shell: false, stdio: "pipe" })`
- Capture stdout/stderr in stream chunks, forward to RunLogStore
- Maintain rolling tail excerpts in memory for DB diagnostic fields
- Emit live log events to websocket subscribers
- Graceful cancel: `SIGTERM`, then `SIGKILL` after `graceSec`
- Enforce timeout via `timeoutSec`

## Agent Instruction Files

Agent behavior is configured via markdown files in `agents/<name>/`:

| File | Purpose |
|---|---|
| `AGENTS.md` | Core identity, role, rules (injected via `--append-system-prompt-file`) |
| `HEARTBEAT.md` | What to do each heartbeat cycle |
| `SOUL.md` | Personality and communication style |
| `TOOLS.md` | Available tools and how to use them |

The `instructionsFilePath` in adapter config points to `AGENTS.md`. The `$AGENT_HOME` env var (set via adapter env config) tells the agent where to find sibling files.

## [[prompt-templates]] Integration

The `promptTemplate` field supports mustache-style variables: `{{agent.id}}`, `{{company.name}}`, `{{run.id}}`, `{{heartbeat.reason}}`, etc. Templates are validated on save.
