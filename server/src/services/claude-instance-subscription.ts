import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import type {
  InstanceClaudeAuthSession,
  InstanceClaudeConnectionProbeResult,
  InstanceClaudeSubscriptionAuthResponse,
  InstanceClaudeSubscriptionStatus,
} from "@paperclipai/shared";
import {
  runChildProcess as runInteractiveChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { appendWithCap, ensureCommandResolvable, ensurePathInEnv, runChildProcess } from "../adapters/utils.js";
import { loadConfig } from "../config.js";
import { logger } from "../middleware/logger.js";
import { resolveClaudeSharedSubscriptionHome } from "./instance-agent-auth.js";

const CLAUDE_COMMAND = "claude";
const CLAUDE_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|please\s+log\s+in|please\s+run\s+`?claude(?:\s+auth)?\s+login`?|login\s+required|requires\s+login|unauthorized|authentication\s+required)/i;
const URL_RE = /https?:\/\/[^\s'"`<>()[\]{}]+/gi;

type MutableClaudeAuthSession = InstanceClaudeAuthSession;

let currentSession: MutableClaudeAuthSession = {
  state: "idle",
  loginUrl: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  signal: null,
  stdout: "",
  stderr: "",
};

let activeChild: ChildProcess | null = null;

function cloneSession(): InstanceClaudeAuthSession {
  return { ...currentSession };
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function summarizeProbeOutput(stdout: string, stderr: string): string | null {
  return firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout) || null;
}

export function extractClaudeLoginUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match || match.length === 0) return null;
  for (const rawUrl of match) {
    const cleaned = rawUrl.replace(/[\])}.!,?;:'\"]+$/g, "");
    if (cleaned.includes("claude") || cleaned.includes("anthropic") || cleaned.includes("auth")) {
      return cleaned;
    }
  }
  return match[0]?.replace(/[\])}.!,?;:'\"]+$/g, "") ?? null;
}

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") normalized[key] = value;
  }
  return normalized;
}

function parseClaudeStreamJson(stdout: string): { summary: string; resultJson: Record<string, unknown> | null } {
  const assistantTexts: string[] = [];
  let resultJson: Record<string, unknown> | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type === "assistant") {
      const message =
        typeof event.message === "object" && event.message !== null && !Array.isArray(event.message)
          ? (event.message as Record<string, unknown>)
          : null;
      const content = Array.isArray(message?.content) ? message.content : [];
      for (const entry of content) {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
        if (entry.type === "text" && typeof entry.text === "string" && entry.text.trim()) {
          assistantTexts.push(entry.text.trim());
        }
      }
      continue;
    }

    if (event.type === "result") {
      resultJson = event;
    }
  }

  const resultText =
    resultJson && typeof resultJson.result === "string" && resultJson.result.trim()
      ? resultJson.result.trim()
      : "";
  return {
    summary: resultText || assistantTexts.join("\n\n").trim(),
    resultJson,
  };
}

function detectClaudeLoginRequired(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { requiresLogin: boolean; loginUrl: string | null } {
  const resultText =
    input.parsed && typeof input.parsed.result === "string" ? input.parsed.result.trim() : "";
  const messages = [resultText, input.stdout, input.stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    requiresLogin: messages.some((line) => CLAUDE_AUTH_REQUIRED_RE.test(line)),
    loginUrl: extractClaudeLoginUrl([input.stdout, input.stderr].join("\n")),
  };
}

function parseStatusJson(stdout: string): { loggedIn: boolean; authMethod: string | null; apiProvider: string | null } {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return {
      loggedIn: parsed.loggedIn === true,
      authMethod: typeof parsed.authMethod === "string" ? parsed.authMethod : null,
      apiProvider: typeof parsed.apiProvider === "string" ? parsed.apiProvider : null,
    };
  } catch {
    return {
      loggedIn: false,
      authMethod: null,
      apiProvider: null,
    };
  }
}

async function resolveRuntime() {
  const runtimeConfig = loadConfig();
  const sharedConfigDir = resolveClaudeSharedSubscriptionHome(runtimeConfig);
  await fs.mkdir(sharedConfigDir, { recursive: true });
  await fs.mkdir(runtimeConfig.agentRuntimeDir, { recursive: true }).catch(() => {});

  const env = toStringEnv(ensurePathInEnv({
    ...process.env,
    ANTHROPIC_API_KEY: "",
    CLAUDE_CONFIG_DIR: sharedConfigDir,
  }));

  const cwd = runtimeConfig.agentRuntimeDir;
  await ensureCommandResolvable(CLAUDE_COMMAND, cwd, env);

  return {
    command: CLAUDE_COMMAND,
    cwd,
    env,
    sharedConfigDir,
  };
}

function markSessionFinished(
  state: "succeeded" | "failed",
  result: { exitCode: number | null; signal: string | null },
) {
  currentSession = {
    ...currentSession,
    state,
    exitCode: result.exitCode,
    signal: result.signal,
    finishedAt: new Date().toISOString(),
  };
  activeChild = null;
}

export async function startClaudeInstanceAuth(): Promise<InstanceClaudeAuthSession> {
  if (activeChild && currentSession.state === "pending") {
    return cloneSession();
  }

  const runtime = await resolveRuntime();
  currentSession = {
    state: "pending",
    loginUrl: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    signal: null,
    stdout: "",
    stderr: "",
  };

  const child = spawn(runtime.command, ["auth", "login"], {
    cwd: runtime.cwd,
    env: runtime.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  activeChild = child;

  child.stdout?.on("data", (chunk: unknown) => {
    currentSession.stdout = appendWithCap(currentSession.stdout, String(chunk));
    currentSession.loginUrl = extractClaudeLoginUrl(`${currentSession.stdout}\n${currentSession.stderr}`);
  });

  child.stderr?.on("data", (chunk: unknown) => {
    currentSession.stderr = appendWithCap(currentSession.stderr, String(chunk));
    currentSession.loginUrl = extractClaudeLoginUrl(`${currentSession.stdout}\n${currentSession.stderr}`);
  });

  child.on("error", (err) => {
    logger.warn({ err }, "claude instance auth failed to start");
    currentSession.stderr = appendWithCap(
      currentSession.stderr,
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    markSessionFinished("failed", { exitCode: null, signal: null });
  });

  child.on("close", (code, signal) => {
    markSessionFinished(code === 0 ? "succeeded" : "failed", {
      exitCode: code,
      signal,
    });
  });

  return cloneSession();
}

export function getClaudeInstanceAuthSession(): InstanceClaudeAuthSession {
  return cloneSession();
}

export async function getClaudeInstanceSubscriptionStatus(): Promise<InstanceClaudeSubscriptionStatus> {
  const runtime = await resolveRuntime();
  const proc = await runChildProcess("claude-instance-auth-status", runtime.command, ["auth", "status", "--json"], {
    cwd: runtime.cwd,
    env: runtime.env,
    timeoutSec: 20,
    graceSec: 5,
    onLog: async () => {},
  });
  const parsed = parseStatusJson(proc.stdout);

  return {
    command: runtime.command,
    sharedConfigDir: runtime.sharedConfigDir,
    checkedAt: new Date().toISOString(),
    loggedIn: parsed.loggedIn,
    authMethod: parsed.authMethod,
    apiProvider: parsed.apiProvider,
    exitCode: proc.exitCode,
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}

export async function getClaudeInstanceSubscriptionAuth(): Promise<InstanceClaudeSubscriptionAuthResponse> {
  const status = await getClaudeInstanceSubscriptionStatus();
  return {
    command: status.command,
    sharedConfigDir: status.sharedConfigDir,
    session: getClaudeInstanceAuthSession(),
    loginStatus: status,
  };
}

export async function probeClaudeInstanceConnection(
  mode: "api_key" | "subscription",
  options?: {
    apiKeyOverride?: string | null;
  },
): Promise<InstanceClaudeConnectionProbeResult> {
  const runtimeConfig = loadConfig();
  const runtime = await resolveRuntime();
  const effectiveApiKey = options?.apiKeyOverride?.trim() || runtimeConfig.claudeInstanceApiKey || "";

  if (mode === "api_key" && !effectiveApiKey) {
    return {
      mode,
      command: runtime.command,
      sharedConfigDir: null,
      checkedAt: new Date().toISOString(),
      ok: false,
      exitCode: null,
      summary: "No Anthropic API key is stored for Claude.",
      detail: "Save an instance-level Anthropic key first, then retry the API key probe.",
      stdout: "",
      stderr: "",
    };
  }

  const env = {
    ...runtime.env,
    ANTHROPIC_API_KEY: mode === "api_key" ? effectiveApiKey : "",
  };
  const probe = await runInteractiveChildProcess(
    `claude-instance-probe-${mode}-${Date.now()}`,
    runtime.command,
    ["--print", "-", "--output-format", "stream-json", "--verbose"],
    {
      cwd: runtime.cwd,
      env,
      timeoutSec: 45,
      graceSec: 5,
      stdin: "Respond with exactly: connection ok",
      onLog: async () => {},
      onLogError: () => {},
    },
  );

  const parsed = parseClaudeStreamJson(probe.stdout);
  const loginMeta = detectClaudeLoginRequired({
    parsed: parsed.resultJson,
    stdout: probe.stdout,
    stderr: probe.stderr,
  });
  const detail =
    parsed.summary && parsed.summary !== "connection ok"
      ? parsed.summary.replace(/\s+/g, " ").trim().slice(0, 240)
      : summarizeProbeOutput(probe.stdout, probe.stderr);

  if (probe.timedOut) {
    return {
      mode,
      command: runtime.command,
      sharedConfigDir: mode === "subscription" ? runtime.sharedConfigDir : null,
      checkedAt: new Date().toISOString(),
      ok: false,
      exitCode: probe.exitCode,
      summary: "Connection probe timed out.",
      detail: "Retry the probe. If this keeps happening, inspect the Paperclip runtime environment directly.",
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  }

  if (loginMeta.requiresLogin) {
    return {
      mode,
      command: runtime.command,
      sharedConfigDir: mode === "subscription" ? runtime.sharedConfigDir : null,
      checkedAt: new Date().toISOString(),
      ok: false,
      exitCode: probe.exitCode,
      summary: "Authentication is not ready.",
      detail: detail ?? loginMeta.loginUrl,
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  }

  if ((probe.exitCode ?? 1) === 0) {
    return {
      mode,
      command: runtime.command,
      sharedConfigDir: mode === "subscription" ? runtime.sharedConfigDir : null,
      checkedAt: new Date().toISOString(),
      ok: true,
      exitCode: probe.exitCode,
      summary: "Connection working.",
      detail,
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  }

  return {
    mode,
    command: runtime.command,
    sharedConfigDir: mode === "subscription" ? runtime.sharedConfigDir : null,
    checkedAt: new Date().toISOString(),
    ok: false,
    exitCode: probe.exitCode,
    summary: "Connection probe failed.",
    detail,
    stdout: probe.stdout,
    stderr: probe.stderr,
  };
}
