import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  ServerAdapterModule,
} from "../types.js";
import { execute as processExecute } from "../process/execute.js";
import { testEnvironment as processTestEnvironment } from "../process/test.js";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asNumber, asString, asStringArray, parseObject } from "../utils.js";

const CRCA_Q_DOC = `# crca_q agent (CRCA-Q quant runner)

Runs the \`crca-q\` CLI on each heartbeat. Requires the package on the host:

\`\`\`sh
cd path/to/Intellitrade-CRCA/crca_q && pip install -e .
# Optional: pip install -r ../CR-CA/requirements.txt for full signals
\`\`\`

## adapterConfig

| Field | Required | Description |
|-------|----------|-------------|
| \`cwd\` | **Yes** | Directory that contains \`CR-CA/\` (e.g. repo root \`Intellitrade-CRCA\`) so the runner can load \`CR-CA/branches/CRCA-Q.py\`. |
| \`command\` | No | Default \`crca-q\`. Override if using \`python -m crca_q.cli\`. |
| \`args\` | No | Default \`["run", "--json"]\`. |
| \`timeoutSec\` | No | Default 900. |
| \`graceSec\` | No | Default 15. |
| \`env\` | No | e.g. \`CRCA_Q_EXECUTION_MODE\`: \`disabled\` (default) | \`paper\` | \`live\`. Exchange API keys if live. |

## Injected by Paperclip

Same as process adapter: \`PAPERCLIP_CONTEXT_JSON\`, \`PAPERCLIP_AGENT_JWT\`, \`PAPERCLIP_API_URL\`.

## Output

JSON on stdout; optional issue comment when \`issueId\` is in context.
`;

function mergeCrcaQConfig(config: Record<string, unknown>): Record<string, unknown> {
  const c = parseObject(config);
  const command = asString(c.command, "").trim() || "crca-q";
  let args = asStringArray(c.args);
  if (args.length === 0) args = ["run", "--json"];
  const timeoutSec = asNumber(c.timeoutSec, 0) || 900;
  const graceSec = asNumber(c.graceSec, 0) || 15;
  return {
    ...c,
    command,
    args,
    timeoutSec,
    graceSec,
  };
}

async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  return processExecute({ ...ctx, config: mergeCrcaQConfig(ctx.config) });
}

async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const merged = mergeCrcaQConfig(ctx.config);
  const inner = await processTestEnvironment({ ...ctx, config: merged });
  return { ...inner, adapterType: "crca_q" };
}

export const crcaQAdapter: ServerAdapterModule = {
  type: "crca_q",
  execute,
  testEnvironment,
  models: [],
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: CRCA_Q_DOC,
};
