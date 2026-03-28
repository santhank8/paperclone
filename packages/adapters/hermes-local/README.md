# @paperclipai/adapter-hermes-local

Paperclip adapter for **Hermes Agent** — run Hermes Agent as a managed employee in a Paperclip company.

> **Note:** The implementation lives in the [`hermes-paperclip-adapter`](https://www.npmjs.com/package/hermes-paperclip-adapter) npm package, maintained by [Nous Research](https://nousresearch.com). This workspace package re-exports it for monorepo consistency.

## What is Hermes Agent?

[Hermes Agent](https://github.com/NousResearch/hermes-agent) is a full-featured AI agent with:
- 30+ native tools (terminal, file, web, browser, memory, MCP, and more)
- Persistent session memory across heartbeat runs
- Skills system for reusable workflows
- Support for **any model** via OpenRouter, Anthropic, OpenAI, GitHub Copilot, and more
- Cost-efficient: can run entirely on free providers (GitHub Copilot)

## Setup

1. Install Hermes Agent:
   ```bash
   pip install hermes-agent
   # or clone from https://github.com/NousResearch/hermes-agent
   ```

2. Configure your model in `~/.hermes/.env`:
   ```
   # Free option (GitHub Copilot)
   MODEL=copilot/gpt-5.3-codex
   
   # Or use Anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   MODEL=anthropic/claude-sonnet-4
   ```

3. In Paperclip, create a new agent and select **Hermes Agent (local)** as the adapter type.

4. Set the **Hermes command** field to the full path of your `hermes` binary if it's not in `PATH` (e.g. `/home/user/git/hermes-agent/venv/bin/hermes`).

## Configuration Fields

| Field | Default | Description |
|-------|---------|-------------|
| `model` | `anthropic/claude-sonnet-4` | Model to use (any Hermes-supported model) |
| `hermesCommand` | `hermes` | Path to the hermes binary |
| `toolsets` | *(hermes defaults)* | Comma-separated toolsets to enable |
| `persistSession` | `true` | Resume conversation between runs |
| `worktreeMode` | `false` | Run in isolated git worktree |
| `checkpoints` | `false` | Enable filesystem checkpoints |
| `timeoutSec` | `300` | Max execution time per run |
| `graceSec` | `10` | Grace period after SIGTERM |
| `promptTemplate` | *(built-in)* | Custom Mustache prompt template |
| `extraArgs` | `[]` | Additional CLI arguments |
| `env` | `{}` | Extra environment variables |

## Cost

Hermes Agent supports **GitHub Copilot** as a free model provider. Set `model` to `copilot/gpt-5.3-codex` to run agents at zero cost (requires GitHub Copilot subscription).
