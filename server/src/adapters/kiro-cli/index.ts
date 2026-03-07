import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "../acp/test.js";
import { listAcpModels } from "../acp-models.js";

export const kiroCliAdapter: ServerAdapterModule = {
  type: "kiro_cli",
  execute,
  testEnvironment,
  listModels: () => listAcpModels(),
  sessionCodec: {
    deserialize(raw: unknown) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      const sessionId = typeof record.sessionId === "string" ? record.sessionId : null;
      if (!sessionId) return null;
      return { sessionId };
    },
    serialize(params: Record<string, unknown> | null) {
      if (!params) return null;
      const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;
      if (!sessionId) return null;
      return { sessionId };
    },
    getDisplayId(params: Record<string, unknown> | null) {
      if (!params) return null;
      return typeof params.sessionId === "string" ? params.sessionId : null;
    },
  },
  models: [],
  agentConfigurationDoc: `# Kiro CLI adapter

Runs Kiro CLI as an ACP agent with first-class support for Kiro-specific options.

## Config fields

- **command** (string, default: "kiro-cli"): Path to the kiro-cli binary
- **args** (string[], default: ["acp"]): Base command arguments
- **model** (string, optional): Model ID passed via \`--model\` flag
- **agent** (string, optional): Named agent profile passed via \`--agent\` flag
- **trustAllTools** (boolean, default: false): Pass \`--trust-all-tools\` to auto-approve permissions
- **cwd** (string, optional): Working directory for the agent process
- **env** (object, optional): Additional environment variables
- **timeoutSec** (number, default: 0 = unlimited): Per-request timeout

## Protocol

Uses ACP (Agent Client Protocol) — stdio-based JSON-RPC 2.0.
Model selection is done via CLI \`--model\` flag at spawn time rather than \`session/set_model\`.

## Example config

\`\`\`json
{
  "command": "kiro-cli",
  "model": "claude-sonnet-4.6",
  "agent": "my-agent",
  "trustAllTools": true,
  "cwd": "/path/to/project"
}
\`\`\`
`,
};
