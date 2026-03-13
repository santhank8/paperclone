export const type = "picoclaw_local";
export const label = "PicoClaw (local)";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# picoclaw_local agent configuration

Adapter: picoclaw_local

Use when:
- You want Paperclip to run PicoClaw locally as the agent runtime
- You want CLI-driven heartbeats via \`picoclaw agent\`
- You want PicoClaw session continuity across heartbeats via \`--session\`
- You want to reuse your local PicoClaw onboarding and config at ~/.picoclaw/config.json

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- PicoClaw CLI is not installed on the machine

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the heartbeat prompt
- promptTemplate (string, optional): heartbeat prompt template passed via --message
- model (string, optional): PicoClaw model alias override passed via --model
- command (string, optional): defaults to "picoclaw"
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Run \`picoclaw onboard\` first so ~/.picoclaw/config.json exists.
- Use \`picoclaw model\` to inspect configured models.
- If \`model\` is omitted, PicoClaw uses its configured default model.
- Sessions are logical PicoClaw session keys and are resumed with \`--session\`.
`;
