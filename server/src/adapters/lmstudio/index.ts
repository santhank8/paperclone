import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const lmstudioAdapter: ServerAdapterModule = {
  type: "lmstudio_local",
  execute,
  testEnvironment,
  models: [],
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: `# lmstudio_local agent configuration

Adapter: lmstudio_local

Connects directly to a running LM Studio instance via its OpenAI-compatible API.
No bridge script required.

Core fields:
- baseUrl (string, optional): LM Studio base URL. Default: http://127.0.0.1:1234
- model (string, optional): Model ID to use. Default: qwen/qwen3.5-35b-a3b
- temperature (number, optional): Sampling temperature. Default: 0.2
- systemPrompt (string, optional): Override the default system prompt
- timeoutMs (number, optional): Request timeout in ms. Default: 120000

Requirements:
- LM Studio must be running locally with the configured model loaded
- LM Studio server must be enabled (Settings > Local Server > Start Server)
`,
};
