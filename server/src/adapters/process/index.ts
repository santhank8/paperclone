import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const processAdapter: ServerAdapterModule = {
  type: "process",
  execute,
  testEnvironment,
  models: [],
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: `# process agent configuration

Adapter: process

Core fields:
- command (string, required): command to execute
- args (string[] | string, optional): command arguments
- cwd (string, optional): absolute working directory
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Injected by the host (do not set manually in adapterConfig.env):
- PAPERCLIP_CONTEXT_JSON: JSON with companyId, agentId, heartbeatRunId, plus heartbeat contextSnapshot (e.g. issueId)
- PAPERCLIP_AGENT_JWT: short-lived bearer JWT for the current run (when local agent JWT is enabled)
`,
};
