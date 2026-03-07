import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { execute as acpExecute } from "../acp/execute.js";
import { asString, asStringArray, asBoolean } from "../utils.js";

// ---------------------------------------------------------------------------
// Kiro CLI adapter — execute
//
// Thin wrapper around the ACP adapter that passes Kiro-specific CLI flags:
//   --model <MODEL>         Model to use for the session
//   --agent <AGENT>         Named agent profile
//   --trust-all-tools       Auto-approve all tool permission requests
//   --verbose               Increase logging verbosity
// ---------------------------------------------------------------------------

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config } = ctx;

  // Build Kiro-specific CLI args
  const baseArgs = asStringArray(config.args).length > 0 ? asStringArray(config.args) : ["acp"];
  const extraArgs: string[] = [];

  const model = asString(config.model, "");
  if (model) {
    extraArgs.push("--model", model);
  }

  const agent = asString(config.agent, "");
  if (agent) {
    extraArgs.push("--agent", agent);
  }

  if (asBoolean(config.trustAllTools, false)) {
    extraArgs.push("--trust-all-tools");
  }

  // Delegate to ACP execute with modified config:
  // - Override args to include Kiro flags
  // - Clear model so ACP doesn't also call session/set_model
  const kiroConfig: Record<string, unknown> = {
    ...config,
    command: asString(config.command, "kiro-cli"),
    args: [...baseArgs, ...extraArgs],
    model: "", // model is passed via CLI, not session/set_model
  };

  return acpExecute({
    ...ctx,
    config: kiroConfig,
  });
}
