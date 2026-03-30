export const type = "opencode_local";
export const label = "OpenCode (local)";

/**
 * Well-known OpenCode models. These are statically listed so Paperclip can
 * populate the model picker without requiring a live `opencode models` call
 * at configuration time. Users may also type any valid provider/model string
 * directly into the model field.
 *
 * OpenCode provider format: provider/model
 * Ollama cloud format: ollama/model-name:tag
 */
export const models: Array<{ id: string; label: string }> = [
  // Anthropic
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Anthropic)" },
  { id: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5 (Anthropic)" },
  { id: "anthropic/claude-haiku-3-5", label: "Claude Haiku 3.5 (Anthropic)" },

  // OpenAI
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { id: "openai/o3-mini", label: "o3 Mini (OpenAI)" },

  // OpenCode free tier
  { id: "opencode/gpt-5-mini", label: "GPT-5 Mini (OpenCode)" },
  { id: "opencode/gpt-5", label: "GPT-5 (OpenCode)" },
  { id: "opencode/minimax-m2.5-free", label: "MiniMax M2.5 Free (OpenCode)" },

  // Google
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
  { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash (Google)" },

  // Ollama cloud models (ollama/model:cloud format)
  // LLM
  { id: "ollama/minimax-m2.7:cloud", label: "MiniMax M2.7 — Coding + Agentic (Ollama Cloud)" },
  { id: "ollama/minimax-m2.5:cloud", label: "MiniMax M2.5 — Productivity (Ollama Cloud)" },
  { id: "ollama/qwen3.5:cloud", label: "Qwen 3.5 — Multimodal Vision + Tools (Ollama Cloud)" },
  { id: "ollama/qwen3.5:122b-cloud", label: "Qwen 3.5 122B (Ollama Cloud)" },
  { id: "ollama/qwen3-next:cloud", label: "Qwen3 Next 80B — Efficient + Fast (Ollama Cloud)" },
  { id: "ollama/glm-5:cloud", label: "GLM-5 744B MoE — Reasoning (Ollama Cloud)" },
  { id: "ollama/kimi-k2.5:cloud", label: "Kimi K2.5 — Agentic + Vision (Ollama Cloud)" },
  { id: "ollama/rnj-1:cloud", label: "RNJ-1 8B — Code + STEM (Ollama Cloud)" },
  // Code
  { id: "ollama/qwen3-coder-next:cloud", label: "Qwen3 Coder Next — Agentic Coding (Ollama Cloud)" },
  { id: "ollama/devstral-small-2:cloud", label: "Devstral Small 2 24B — Multi-file Editing (Ollama Cloud)" },
  { id: "ollama/devstral-2:cloud", label: "Devstral 2 123B — Tool-using Engineering (Ollama Cloud)" },
  // Vision-Language
  { id: "ollama/qwen3-vl:cloud", label: "Qwen3 VL — Vision Language (Ollama Cloud)" },
  // MoE / Edge
  { id: "ollama/nemotron-3-super:cloud", label: "Nemotron 3 Super 120B MoE (Ollama Cloud)" },
  { id: "ollama/nemotron-3-nano:cloud", label: "Nemotron 3 Nano — Efficient Agentic (Ollama Cloud)" },
  { id: "ollama/ministral-3:cloud", label: "Ministral 3 — Edge Optimized (Ollama Cloud)" },
];

  // Anthropic (latest)
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Anthropic)" },
  { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6 (Anthropic)" },

  // OpenAI (latest)
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { id: "openai/o3", label: "o3 (OpenAI)" },
  { id: "openai/o4-mini", label: "o4 Mini (OpenAI)" },

  // Google (latest)
  { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro Preview (Google)" },

  // Ollama cloud models (chat/completion only — embedding models excluded)
  { id: "ollama/qwen3.5:cloud", label: "Qwen 3.5 (Ollama Cloud)" },
  { id: "ollama/qwen3.5:397b-cloud", label: "Qwen 3.5 397B (Ollama Cloud)" },
  { id: "ollama/glm-5:cloud", label: "GLM-5 (Ollama Cloud)" },
  { id: "ollama/minimax-m2.5:cloud", label: "MiniMax M2.5 (Ollama Cloud)" },
  { id: "ollama/minimax-m2.7:cloud", label: "MiniMax M2.7 (Ollama Cloud)" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: opencode_local

Use when:
- You want Paperclip to run OpenCode locally as the agent runtime
- You want provider/model routing in OpenCode format (provider/model)
- You want OpenCode session resume across heartbeats via --session

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- model (string, required): OpenCode model id in provider/model format (for example anthropic/claude-sonnet-4-5)
- variant (string, optional): provider-specific model variant (for example minimal|low|medium|high|max)
- dangerouslySkipPermissions (boolean, optional): inject a runtime OpenCode config that allows \`external_directory\` access without interactive prompts; defaults to true for unattended Paperclip runs
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- OpenCode supports multiple providers and models. Use \
  \`opencode models\` to list available options in provider/model format.
- Paperclip requires an explicit \`model\` value for \`opencode_local\` agents.
- Runs are executed with: opencode run --format json ...
- Sessions are resumed with --session when stored session cwd matches current cwd.
- The adapter sets OPENCODE_DISABLE_PROJECT_CONFIG=true to prevent OpenCode from \
  writing an opencode.json config file into the project working directory. Model \
  selection is passed via the --model CLI flag instead.
- When \`dangerouslySkipPermissions\` is enabled, Paperclip injects a temporary \
  runtime config with \`permission.external_directory=allow\` so headless runs do \
  not stall on approval prompts.
`;
