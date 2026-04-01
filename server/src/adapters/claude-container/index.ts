import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test-env.js";
import { sessionCodec } from "@paperclipai/adapter-claude-local/server";
import { getAdapterSessionManagement } from "@paperclipai/adapter-utils";
import { models as claudeModels } from "@paperclipai/adapter-claude-local";

export const claudeContainerAdapter: ServerAdapterModule = {
  type: "claude_container",
  execute,
  testEnvironment,
  sessionCodec,
  sessionManagement: getAdapterSessionManagement("claude_local") ?? undefined,
  models: claudeModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: `# claude_container agent configuration

Adapter: claude_container

Executes Claude Code inside Docker containers for security-isolated agent runs.

Core fields:
- image (string, optional): Docker image, default "nanoclaw-agent:latest"
- network (string, optional): Docker network, default "pkb-net"
- memoryMb (number, optional): container memory limit in MB, default 2048
- cpus (number, optional): container CPU limit, default 1.5
- model (string, optional): Claude model id
- effort (string, optional): reasoning effort (low|medium|high)
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to claude
- instructionsFilePath (string, optional): path to agent instructions markdown (host-side)
- extraArgs (string[], optional): additional Claude CLI args
- env (object, optional): KEY=VALUE environment variables passed to container

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`,
};
