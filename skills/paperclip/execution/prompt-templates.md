---
title: Prompt Templates
description: Mustache-style variable injection for agent prompts — pills, validation, and credential handling
type: pattern
links: [claude-local-adapter, ../goal-hierarchy, heartbeat-system]
---

# Prompt Templates

Agent prompts in Paperclip support mustache-style variable injection. Templates are validated on save and rendered at runtime with current context.

## Template Format

```
You are {{agent.name}}, the {{agent.role}} of {{company.name}}.
This is run {{run.id}}, triggered by {{run.source}}.
Reason: {{heartbeat.reason}}
```

No arbitrary code execution. Unknown variables on save = validation error.

## Variable Catalog

| Variable | Description |
|---|---|
| `company.id` | Company UUID |
| `company.name` | Company display name |
| `agent.id` | Agent UUID |
| `agent.name` | Agent display name |
| `agent.role` | Agent role (ceo, engineer, etc.) |
| `agent.title` | Agent title |
| `run.id` | Current heartbeat run UUID |
| `run.source` | Wakeup source (timer, assignment, on_demand) |
| `run.startedAt` | Run start timestamp |
| `heartbeat.reason` | Why this wakeup was triggered |
| `paperclip.skill` | Shared Paperclip skill text block |
| `credentials.apiBaseUrl` | API base URL |
| `credentials.apiKey` | Agent API key (sensitive) |

## Prompt Fields

The [[claude-local-adapter]] uses `promptTemplate` — applied on every wakeup, both first runs and resumed sessions.

The template carries [[../goal-hierarchy]] context so agents understand not just *what* to do but *why*. The [[heartbeat-system]] renders templates before passing to the adapter.

## UI Features

The agent setup/edit form includes:
- Prompt editors with pill insertion (clickable variable chips)
- Save-time validation for unknown/missing variables
- Sensitive pills (`credentials.*`) show explicit warning badges

## Security Notes

1. Credentials in prompts are allowed for initial simplicity but discouraged
2. Preferred transport: env vars (`PAPERCLIP_*`) injected at runtime
3. Prompt preview and logs must redact sensitive values
4. Never store credential values in prompt text — use variable references

## Agent Instruction Files

Beyond the prompt template, the [[claude-local-adapter]] supports `instructionsFilePath` which injects a full markdown file via `--append-system-prompt-file`. This is where agent identity, rules, and behavioral guidelines live — typically `agents/<name>/AGENTS.md`.
