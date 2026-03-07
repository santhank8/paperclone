import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { listAcpModels } from "../acp-models.js";

export const acpAdapter: ServerAdapterModule = {
  type: "acp",
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
  agentConfigurationDoc: `# ACP (Agent Client Protocol) adapter

Connects Paperclip to any ACP-compatible agent via stdio JSON-RPC 2.0.
Works with Kiro CLI, or any agent implementing the ACP spec.

## Config fields

- **command** (string, default: "kiro-cli"): The ACP agent command to spawn
- **args** (string[], default: ["acp"]): Command arguments
- **cwd** (string, optional): Working directory for the agent process
- **env** (object, optional): Additional environment variables
- **timeoutSec** (number, default: 0 = unlimited): Per-request timeout

## Protocol flow

1. Spawn \`command args\` as a child process
2. Send \`initialize\` with client capabilities over stdin
3. Send \`session/new\` or \`session/load\` (if resuming a session)
4. Send \`session/prompt\` with the task prompt
5. Receive streaming notifications: AgentMessageChunk, ToolCall, ToolCallUpdate, TurnEnd
6. Close stdin when complete

## Session management

ACP session IDs are persisted across Paperclip runs, enabling \`session/load\` resumption.

## Example config

\`\`\`json
{
  "command": "kiro-cli",
  "args": ["acp", "--agent", "my-agent"],
  "cwd": "/path/to/project"
}
\`\`\`
`,
};
