import os from "node:os";
import path from "node:path";
import { runChildProcess, type RunProcessResult } from "@paperclipai/adapter-utils/server-utils";

export type CodexAuthMode = "api_key" | "subscription";

export function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

export function resolveCodexAuthMode(
  config: Record<string, unknown>,
  env: Record<string, string>,
): CodexAuthMode {
  const authMode = typeof config.paperclipAuthMode === "string" ? config.paperclipAuthMode.trim() : "";
  if (authMode === "subscription") return "subscription";
  if (authMode === "instance_api_key") return "api_key";
  return hasNonEmptyEnvValue(env, "OPENAI_API_KEY") ? "api_key" : "subscription";
}

export function resolveCodexApiKeyHome(env: Record<string, string>): string {
  const configuredHome = env.CODEX_HOME?.trim();
  if (configuredHome) return configuredHome;

  const agentHome = env.AGENT_HOME?.trim();
  if (agentHome) return path.join(agentHome, ".codex-api-key");

  return path.join(os.homedir(), ".codex-api-key");
}

export async function loginCodexWithApiKey(input: {
  runId: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  apiKey: string;
  timeoutSec?: number;
  graceSec?: number;
  onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}): Promise<RunProcessResult> {
  return runChildProcess(
    input.runId,
    input.command,
    ["login", "--with-api-key"],
    {
      cwd: input.cwd,
      env: input.env,
      timeoutSec: input.timeoutSec ?? 20,
      graceSec: input.graceSec ?? 5,
      stdin: `${input.apiKey.trim()}\n`,
      onLog: input.onLog ?? (async () => {}),
    },
  );
}
