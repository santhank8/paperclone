import { GITHUB_MODELS, DEFAULT_GITHUB_MODEL } from "./models.js";

export { DEFAULT_GITHUB_MODEL };

export const type = "copilot_local";
export const label = "GitHub Copilot";

export const models: Array<{ id: string; label: string }> = GITHUB_MODELS.map(({ id, label }) => ({
  id,
  label,
}));

export const agentConfigurationDoc = `# copilot_local agent configuration

Adapter: copilot_local

Use when:
- You have a GitHub Copilot subscription and want to use GitHub Models API
- You want access to GPT-4o, Claude 3.5 Sonnet, and other models at $0 per token
- You have a GITHUB_TOKEN environment variable set

Don't use when:
- You don't have a GitHub Copilot subscription
- You need a local agentic coding assistant (use claude_local, codex_local, etc.)
- You need tool/function calling with an agentic loop

Core fields:
- model (string, optional): GitHub Models model id (default: gpt-4o)
  Available: gpt-4o, gpt-4o-mini, claude-3-5-sonnet, claude-3-5-haiku, llama-3.3-70b-instruct, mistral-large
- promptTemplate (string, optional): user prompt template; supports {{agent.id}}, {{agent.name}}, {{runId}}, {{context.*}}
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected as system prompt
- maxTokens (number, optional): maximum tokens to generate (default: 4096)
- timeoutSec (number, optional): request timeout in seconds (default: 120)
- env (object, optional): KEY=VALUE environment variables; GITHUB_TOKEN can be set here or in host env

Auth fields:
- env.GITHUB_TOKEN (string): GitHub Personal Access Token with Copilot access
  Can also be set as GITHUB_TOKEN in the server host environment.
`;
