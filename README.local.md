# Paperclip — Local Setup (JeremySarda.com)

Local Paperclip instance for Jeremy Sarda in Las Vegas, NV.

## Requirements

- **Node.js 22** via asdf (`nodejs 22.21.1` pinned in `.tool-versions`)
- **pnpm 9.15.4** via corepack (auto-activated)
- **LM Studio** (optional) — for direct local model agents

> ⚠️ Do NOT use Node 24+ with this repo. The `sharp` image library fails to install on
> Node 24 when Homebrew `vips` is detected. Node 22 uses the prebuilt binary cleanly.

## Quick Start

```bash
cd /Volumes/JS-DEV/paperclip
./start.sh
```

Open: http://127.0.0.1:3100

## Stop

```bash
./stop.sh
```

## What `start.sh` does

1. Sets `PATH` to Node 22 via asdf
2. Detects LM Studio at `http://127.0.0.1:1234` — if running, starts the LM Studio bridge in background on port 3199
3. Starts Paperclip (`pnpm dev:once`) — auto-migrates DB, serves UI + API

## Data

- **Paperclip instance:** `~/.paperclip/instances/default`
- **Embedded Postgres:** `~/.paperclip/instances/default/db` (port 54329)
- **Config:** `~/.paperclip/instances/default/config.json`
- **Backups:** `~/.paperclip/instances/default/data/backups` (hourly, 30d retention)

## Company: JeremySarda.com

Single company configured. Issue prefix: `JER`.

## Agents

| Name | Adapter | Notes |
|------|---------|-------|
| Jeremy CEO | process | Placeholder exec agent |
| Donna (Claude Sonnet) | openclaw_gateway | Main OpenClaw agent (Claude Opus) |
| Jonathan Blow | openclaw_gateway | Research persona |
| Codex Agent (GPT-5.4) | openclaw_gateway | OpenClaw Codex |
| LMS Research Agent (crow-9b) | openclaw_gateway | crow-9b via OpenClaw |
| qwen3.5-35b-a3b | openclaw_gateway | Qwen 35B via OpenClaw |
| qwen-9b-q8 | openclaw_gateway | Qwen 9B via OpenClaw |
| nemotron-3-nano-4b | openclaw_gateway | Nemotron via OpenClaw |
| crow-9b-opus | openclaw_gateway | crow-9b direct via OpenClaw |
| LM Studio Qwen Direct | http | Direct LM Studio (no OpenClaw) |
| Claude Code (native) | claude_local | Native local Claude Code |
| Codex CLI (native) | codex_local | Native local Codex |

### OpenClaw Gateway agents
All gateway agents connect to: `ws://127.0.0.1:18789`

Session strategy: **`run`** (each run gets its own session — prevents cross-agent session collision).

### Direct LM Studio agents (http adapter)
Route through bridge at `http://127.0.0.1:3199`, which talks directly to LM Studio.

## LM Studio Bridge

**Script:** `scripts/lmstudio-bridge.mjs`

A lightweight Node.js HTTP server that translates Paperclip HTTP adapter payloads into LM Studio's OpenAI-compatible API.

### Configuration (env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `LMSTUDIO_BRIDGE_PORT` | `3199` | Local port for the bridge |
| `LMSTUDIO_BASE_URL` | `http://127.0.0.1:1234` | LM Studio base URL |
| `LMSTUDIO_MODEL` | `qwen/qwen3.5-35b-a3b` | Default model |

### Per-agent model selection

Set `adapterConfig.payloadTemplate.model` on the agent to target a specific model:

```json
{
  "adapterType": "http",
  "adapterConfig": {
    "url": "http://127.0.0.1:3199",
    "payloadTemplate": {
      "model": "crow-9b-opus-4.6-distill-heretic_qwen3.5"
    }
  }
}
```

## Known Issues

| Issue | Fix |
|-------|-----|
| `sharp` fails to install on Node 24 | Use Node 22 (pinned in `.tool-versions`) |
| Ollama not running | Start Ollama daemon before creating Ollama agents |
| `corepack` picks up wrong pnpm via asdf | Use `PATH` override in start.sh — already handled |

## Development

```bash
# Install deps (first time or after pulling)
export PATH="$HOME/.asdf/installs/nodejs/22.21.1/bin:$PATH"
SHARP_IGNORE_GLOBAL_LIBVIPS=1 corepack pnpm install

# Build everything
corepack pnpm build

# Run tests
corepack pnpm test:run

# Type check
corepack pnpm typecheck
```
