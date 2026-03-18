export const MISTRAL_LOCAL_ADAPTER_TYPE = "mistral_local" as const;

export const DEFAULT_MISTRAL_MODEL = "mistral-medium-latest";

export const models = [
  // High-quota models — use these for sustained agent workloads
  { id: "devstral-latest", label: "Devstral (latest) — Pool 7: 1M tok/min, 1B tok/month, best for coding" },
  { id: "mistral-medium-latest", label: "Mistral Medium 2508 — Pool 3: 375K tok/min, no monthly cap" },
  { id: "mistral-large-2411", label: "Mistral Large 2411 — Pool 2: 600K tok/5-min, ~unlimited monthly" },
  { id: "labs-leanstral-2603", label: "Leanstral 2603 (labs) — 1M tok/min, no monthly cap" },
  // Reasoning models
  { id: "magistral-medium-latest", label: "Magistral Medium — Pool 6: 75K tok/min, 1B tok/month, chain-of-thought" },
  { id: "magistral-small-latest", label: "Magistral Small — Pool 5: 75K tok/min, 1B tok/month" },
  // Standard pool — 4M tokens/month shared across many models, use sparingly
  { id: "mistral-small-latest", label: "Mistral Small (latest) — Pool 1: 50K tok/min, 4M tok/month shared" },
  { id: "mistral-large-latest", label: "Mistral Large (latest) — Pool 1: 50K tok/min, 4M tok/month shared" },
  { id: "open-mistral-nemo", label: "Mistral Nemo — Pool 1: 50K tok/min, 4M tok/month shared" },
];

export const agentConfigurationDoc = `# mistral_local agent configuration

Adapter: mistral_local

Use when:
- You want Paperclip to call the Mistral API directly on each heartbeat
- You want to use Mistral models without a local CLI install
- You have a MISTRAL_API_KEY available in the environment

Don't use when:
- You need a full local agentic loop with file edits and tool use (use claude_local or opencode_local)
- You need webhook-style external invocation (use openclaw_gateway or http)

## Model Selection Guide (Free Tier)

Mistral organizes models into independent quota pools. Choosing wisely prevents hitting monthly caps.

| Model | Pool | Tokens/min | Tokens/month | Best for |
|-------|------|-----------|--------------|----------|
| devstral-latest | 7 | 1,000,000 | 1B | Coding & agentic dev tasks |
| mistral-medium-latest | 3 | 375,000 | No cap | General tasks (recommended default) |
| mistral-large-2411 | 2 | 600,000/5min | ~unlimited | High-volume, legacy tasks |
| labs-leanstral-2603 | — | 1,000,000 | No cap | Highest throughput (experimental) |
| magistral-medium-latest | 6 | 75,000 | 1B | Complex reasoning / planning |
| magistral-small-latest | 5 | 75,000 | 1B | Lightweight reasoning |
| mistral-small/large-latest | 1 | 50,000 | 4M shared | Use sparingly |

⚠️ Pool 1 (mistral-small-latest, mistral-large-latest, open-mistral-nemo, codestral-2508,
ministral-*, pixtral-large, devstral-small/medium-2507) shares only 4 million tokens per month
across 11+ models. It is the easiest pool to exhaust. Prefer devstral-latest or
mistral-medium-latest for sustained workloads.

Global free tier limit: 1 request per second per API key (all pools).

## Core fields:
- model (string, optional): Mistral model id. Defaults to mistral-medium-latest.
- promptTemplate (string, optional): run prompt template
- maxTokens (number, optional): maximum tokens to generate (default: 4096)
- cwd (string, optional): working directory context passed to the model
- env (object, optional): KEY=VALUE environment variables

## Notes:
- MISTRAL_API_KEY must be set in the environment or in the env config field.
- Mistral's API endpoint is OpenAI-compatible: https://api.mistral.ai/v1
- Each heartbeat sends a fresh request; sessions are not resumed across heartbeats.
`;
