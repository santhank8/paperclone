export const type = "ollama_local";
export const label = "Ollama (local)";
export const DEFAULT_OLLAMA_LOCAL_MODEL = "llama3";
export const DEFAULT_OLLAMA_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = false;

export const models = [
  { id: DEFAULT_OLLAMA_LOCAL_MODEL, label: "Llama 3" },
  { id: "llama3:70b", label: "Llama 3 (70B)" },
  { id: "mistral", label: "Mistral" },
  { id: "mixtral", label: "Mixtral" },
  { id: "gemma:7b", label: "Gemma (7B)" },
  { id: "codestral", label: "Codestral" },
  { id: "phi3", label: "Phi-3" },
];

export const agentConfigurationDoc = `# ollama_local agent configuration

Adapter: ollama_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Ollama model id
- promptTemplate (string, optional): run prompt template
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "ollama"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin.
Agentic Proactive Prompting:
- If \`proactivePrompting\` is true in the runtime config, the agent will be instructed to automatically ask the user or orchestrator for the next task when it finishes the current one, keeping the process moving without manual intervention.
`;
