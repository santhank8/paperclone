export const type = "gemini_local";
export const label = "Gemini CLI (local)";

export const models = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

export const agentConfigurationDoc = `# gemini_local agent configuration

Adapter: gemini_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- model (string, optional): Gemini model id
- yolo (boolean, optional): pass --yolo to auto-approve all tool calls
- sandbox (boolean, optional): pass --sandbox to run in Docker/Podman sandbox
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "gemini"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`;
