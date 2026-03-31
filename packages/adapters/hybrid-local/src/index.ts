export const type = "hybrid_local";
export const label = "Hybrid (local)";

// Only Claude models are hardcoded — local models are discovered dynamically
// from the OpenAI-compatible /v1/models endpoint via listOpenAICompatModels() in registry.ts.
// Hardcoding local model IDs here causes stale IDs to be stored in agent configs
// when the local server updates its naming convention.
export const models = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
];

export function isClaudeModel(model: string): boolean {
  return model.startsWith("claude-") || model.startsWith("claude/");
}

export const agentConfigurationDoc = `# hybrid_local agent configuration

Adapter: hybrid_local

A hybrid adapter that routes between Claude Code CLI and any OpenAI-compatible
local inference server (LM Studio, Ollama, LiteLLM, vLLM, etc.).

Select a Claude model to run via the Claude CLI, or a local model to run via
the configured OpenAI-compatible endpoint. Supports bidirectional fallback:
- Claude model fails (quota/auth) → falls back to local model
- Local model fails (server down/GPU busy) → falls back to Claude model

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, required): model id — Claude models (claude-*) route to CLI, others route to local endpoint
- fallbackModel (string, optional): model to fall back to when the primary is unavailable; can be Claude or local
- localBaseUrl (string, optional): OpenAI-compatible API base URL (default: http://127.0.0.1:11434/v1)
- quotaThresholdPercent (number, optional): Claude quota usage percent at which to pre-emptively skip to local (default: 80, set to 0 to disable)
- allowExtraCredit (boolean, optional): whether Claude can continue past quota policy; default false (recommended)
- effort (string, optional): reasoning effort for Claude runs (low|medium|high)
- chrome (boolean, optional): pass --chrome when running Claude
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one Claude run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to Claude
- command (string, optional): Claude CLI command (defaults to "claude")
- extraArgs (string[], optional): additional CLI args for Claude
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy (git_worktree)

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Routing:
- model starts with "claude-" → Claude CLI
- all other models → OpenAI-compatible endpoint at localBaseUrl

Fallback (bidirectional):
- Claude model + quota/auth error → retry with fallbackModel via local endpoint
- Local model + connection/timeout error → retry with fallbackModel via Claude CLI
- Set fallbackModel to "" to disable fallback (fail on error)

Cost policy:
- allowExtraCredit=false (default) enforces fail-closed quota behavior for Claude routing.
- If quota pre-check is unavailable and fallbackModel is unset, Claude run is blocked.

Compatible local backends:
- Ollama (default, http://127.0.0.1:11434/v1)
- LM Studio (http://127.0.0.1:1234/v1)
- LiteLLM proxy (http://127.0.0.1:4000/v1)
- Any OpenAI-compatible server

Local model selection:

RECOMMENDED: qwen2.5-coder (7b/32b variants)
- Best tool-calling support among open models
- Strong code generation and reasoning
- 7b: ~7GB VRAM, 32b: ~24GB VRAM
- Expected token burn: 2-4x Claude for equivalent task
- Best for: CI/CD, code review, testing, debugging

ALTERNATIVE: llama3.1 (8b/70b variants)
- Larger context window (128k tokens)
- Good general reasoning
- 8b: ~8GB VRAM, 70b: ~40GB VRAM
- Expected token burn: 3-5x Claude
- Best for: Long-context tasks, research, analysis

ALTERNATIVE: mistral (7b/12b variants)
- Fast inference, smaller models
- Good for latency-critical tasks
- 7b: ~6GB VRAM, 12b: ~10GB VRAM
- Expected token burn: 5-8x Claude
- Best for: Lightweight tasks, streaming responses

LOCAL VS CLAUDE COSTS:
- Local: Zero API costs, but GPU compute cost (~$0.50-2.00/hour on consumer GPU)
- Claude: API costs ($3-30 per million tokens depending on model)
- Break-even point: ~5M tokens of equivalent work using qwen2.5-coder (7b)
- Most cost-effective: Use local + Claude fallback for quota management

Notes:
- Claude runs inherit all claude_local behavior (sessions, skills, quota).
- Local runs are stateless (no session resume).
- The local endpoint must be running with a model loaded for local routing to work.
- Token limits: 30 tool turns max, 100k tokens total, 5 tools per turn max, 1MB output per command.
- Guards: Dangerous command blocklist (rm -rf, sudo, dd, fdisk, format, shutdown, reboot, halt, poweroff, pkill, kill -9).
`;
