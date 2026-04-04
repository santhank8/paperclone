# GitHub Copilot Adapter for Paperclip

Use GitHub Models API with your GitHub Copilot subscription.

## Setup
1. Set GITHUB_TOKEN environment variable (same token as `gh auth`)
2. Select "GitHub Copilot" in your agent's adapter settings
3. Choose from GPT-4o, Claude 3.5 Sonnet, and other GitHub-available models

## Authentication
Uses GITHUB_TOKEN — the same Personal Access Token used by `gh` CLI.
GitHub Copilot subscribers get access to models at $0 per token.

To get your token:
```bash
gh auth token
```

Or create a Personal Access Token at https://github.com/settings/tokens with `models:read` scope (if required).

## Available Models
- `gpt-4o` (OpenAI) — Best overall (default)
- `gpt-4o-mini` (OpenAI) — Fast and economical
- `claude-3-5-sonnet` (Anthropic) — Best for reasoning
- `claude-3-5-haiku` (Anthropic) — Fast Claude
- `llama-3.3-70b-instruct` (Meta) — Open source
- `mistral-large` (Mistral) — Strong European model

## Adapter Configuration

```json
{
  "adapterType": "copilot_local",
  "model": "gpt-4o",
  "promptTemplate": "You are agent {{agent.id}}. {{context.wakeReason}}",
  "maxTokens": 4096,
  "timeoutSec": 120,
  "env": {
    "GITHUB_TOKEN": "ghp_..."
  }
}
```

## API
Uses the GitHub Models API (OpenAI-compatible) at `https://models.inference.ai.azure.com`.

See: https://docs.github.com/en/github-models
