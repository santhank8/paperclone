export const type = "ollama_local";
export const label = "Ollama (local)";
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# ollama_local agent configuration

Adapter: ollama_local

Use when:
- You want Paperclip to call a local Ollama server directly
- You need local models such as qwen2.5, llama, mistral, or gemma
- You want a local-model worker that can draft Issue replies inside Paperclip

Don't use when:
- You need a full coding-agent CLI with tool execution and native session resume
- You want a remote webhook or gateway adapter (use http or openclaw_gateway)

Core fields:
- baseUrl (string, optional): Ollama server base URL. Defaults to ${DEFAULT_OLLAMA_BASE_URL}
- model (string, required): Ollama model name, for example qwen2.5:7b
- allowUndiscoveredModel (boolean, optional): allow a manual model even if /api/tags does not list it
- instructionsFilePath (string, optional): optional markdown instructions file appended to the system prompt
- promptTemplate (string, optional): system prompt template used for each run

Notes:
- This adapter talks to Ollama's native HTTP API (/api/tags and /api/chat).
- It is intentionally lightweight: it posts text back to Paperclip Issues, but it is not a tool-using coding CLI.
- If you paste an OpenAI-compatible Ollama URL ending in /v1, Paperclip normalizes it back to the native Ollama base URL.
`;
