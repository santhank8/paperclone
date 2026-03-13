export const type = "opencode_local";
export const label = "OpenCode (local)";

export const models: Array<{ id: string; label: string }> = [
  { id: "anthropic/claude-3-opus", label: "Claude 3 Opus (Anthropic)" },
  { id: "anthropic/claude-3-sonnet", label: "Claude 3 Sonnet (Anthropic)" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (Anthropic)" },
  { id: "openai/gpt-4", label: "GPT-4 (OpenAI)" },
  { id: "openai/gpt-4-turbo", label: "GPT-4 Turbo (OpenAI)" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/gpt-3.5-turbo", label: "GPT-3.5 Turbo (OpenAI)" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek/deepseek-coder", label: "DeepSeek Coder" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro (Google)" },
  { id: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash (Google)" },
  { id: "mistral/mistral-large", label: "Mistral Large" },
  { id: "meta/llama-3.1-70b", label: "Llama 3.1 70B (Meta)" },
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
`;
