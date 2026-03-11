import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  InstanceCodexConnectionProbeResult,
  InstanceCodexDeviceAuthSession,
  InstanceCodexSubscriptionAuthResponse,
  InstanceCodexSubscriptionStatus,
} from "@paperclipai/shared";
import { loginCodexWithApiKey } from "@paperclipai/adapter-codex-local/server";
import { runChildProcess as runInteractiveChildProcess } from "@paperclipai/adapter-utils/server-utils";
import { appendWithCap, ensureCommandResolvable, ensurePathInEnv, runChildProcess } from "../adapters/utils.js";
import { loadConfig } from "../config.js";
import { logger } from "../middleware/logger.js";
import { resolveCodexSharedSubscriptionHome } from "./instance-agent-auth.js";

const CODEX_COMMAND = "codex";
const DEVICE_LOGIN_URL_RE = /https:\/\/auth\.openai\.com\/codex\/device\b/i;
const DEVICE_CODE_RE = /\b[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/;
const ANSI_RE = /\u001b\[[0-9;]*m/g;

type MutableDeviceAuthSession = InstanceCodexDeviceAuthSession;

let currentSession: MutableDeviceAuthSession = {
  state: "idle",
  loginUrl: null,
  userCode: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  signal: null,
  stdout: "",
  stderr: "",
};

let activeChild: ChildProcess | null = null;

function cloneSession(): InstanceCodexDeviceAuthSession {
  return { ...currentSession };
}

function parseDeviceAuthHints(session: MutableDeviceAuthSession) {
  const combined = `${session.stdout}\n${session.stderr}`;
  if (!session.loginUrl) {
    const loginUrl = combined.match(DEVICE_LOGIN_URL_RE)?.[0] ?? null;
    if (loginUrl) session.loginUrl = loginUrl;
  }
  if (!session.userCode) {
    const userCode = combined.match(DEVICE_CODE_RE)?.[0] ?? null;
    if (userCode) session.userCode = userCode;
  }
}

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") normalized[key] = value;
  }
  return normalized;
}

function stripAnsi(value: string): string {
  return value.replaceAll(ANSI_RE, "");
}

function firstNonEmptyLine(text: string): string {
  return (
    stripAnsi(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function summarizeProbeOutput(stdout: string, stderr: string): string | null {
  return firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout) || null;
}

async function resolveRuntime() {
  const runtimeConfig = loadConfig();
  const sharedHomeDir = resolveCodexSharedSubscriptionHome(runtimeConfig);
  await fs.mkdir(sharedHomeDir, { recursive: true });
  await fs.mkdir(runtimeConfig.agentRuntimeDir, { recursive: true }).catch(() => {});

  const env = toStringEnv(ensurePathInEnv({
    ...process.env,
    CODEX_HOME: sharedHomeDir,
    HOME: sharedHomeDir,
    OPENAI_API_KEY: "",
  }));

  const cwd = runtimeConfig.agentRuntimeDir;
  await ensureCommandResolvable(CODEX_COMMAND, cwd, env);

  return {
    command: CODEX_COMMAND,
    cwd,
    env,
    sharedHomeDir,
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

export async function startCodexInstanceDeviceAuth(): Promise<InstanceCodexDeviceAuthSession> {
  if (activeChild && currentSession.state === "pending") {
    return cloneSession();
  }

  const runtime = await resolveRuntime();
  currentSession = {
    state: "pending",
    loginUrl: null,
    userCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    signal: null,
    stdout: "",
    stderr: "",
  };

  const child = spawn(runtime.command, ["login", "--device-auth"], {
    cwd: runtime.cwd,
    env: runtime.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  activeChild = child;

  child.stdout?.on("data", (chunk: unknown) => {
    currentSession.stdout = appendWithCap(currentSession.stdout, String(chunk));
    parseDeviceAuthHints(currentSession);
  });

  child.stderr?.on("data", (chunk: unknown) => {
    currentSession.stderr = appendWithCap(currentSession.stderr, String(chunk));
    parseDeviceAuthHints(currentSession);
  });

  child.on("error", (err) => {
    logger.warn({ err }, "codex instance device auth failed to start");
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

export function getCodexInstanceDeviceAuthSession(): InstanceCodexDeviceAuthSession {
  return cloneSession();
}

export async function getCodexInstanceSubscriptionStatus(): Promise<InstanceCodexSubscriptionStatus> {
  const runtime = await resolveRuntime();
  const proc = await runChildProcess("codex-instance-login-status", runtime.command, ["login", "status"], {
    cwd: runtime.cwd,
    env: runtime.env,
    timeoutSec: 20,
    graceSec: 5,
    onLog: async () => {},
  });

  return {
    command: runtime.command,
    sharedHomeDir: runtime.sharedHomeDir,
    checkedAt: new Date().toISOString(),
    loggedIn: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}

export async function getCodexInstanceSubscriptionAuth(): Promise<InstanceCodexSubscriptionAuthResponse> {
  const status = await getCodexInstanceSubscriptionStatus();
  return {
    command: status.command,
    sharedHomeDir: status.sharedHomeDir,
    session: getCodexInstanceDeviceAuthSession(),
    loginStatus: status,
  };
}

export async function probeCodexInstanceConnection(
  mode: "api_key" | "subscription",
  options?: {
    apiKeyOverride?: string | null;
  },
): Promise<InstanceCodexConnectionProbeResult> {
  const runtimeConfig = loadConfig();
  const runtime = await resolveRuntime();
  const effectiveApiKey = options?.apiKeyOverride?.trim() || runtimeConfig.codexInstanceApiKey || "";
  const isolatedHomeDir =
    mode === "api_key"
      ? await fs.mkdtemp(path.join(runtimeConfig.agentRuntimeDir, "codex-api-key-probe-"))
      : null;

  if (mode === "api_key" && !effectiveApiKey) {
    return {
      mode,
      command: runtime.command,
      sharedHomeDir: null,
      checkedAt: new Date().toISOString(),
      ok: false,
      exitCode: null,
      summary: "No OpenAI API key is stored for Codex.",
      detail: "Save an instance-level OpenAI key first, then retry the API key probe.",
      stdout: "",
      stderr: "",
    };
  }

  const env = {
    ...runtime.env,
    ...(isolatedHomeDir
      ? {
          CODEX_HOME: isolatedHomeDir,
          HOME: isolatedHomeDir,
        }
      : {}),
    OPENAI_API_KEY: mode === "api_key" ? effectiveApiKey : "",
  };
  try {
    if (mode === "api_key") {
      const login = await loginCodexWithApiKey({
        runId: `codex-instance-probe-login-${Date.now()}`,
        command: runtime.command,
        cwd: runtime.cwd,
        env,
        apiKey: effectiveApiKey,
      });
      if (login.timedOut || (login.exitCode ?? 1) !== 0) {
        const detail = summarizeProbeOutput(login.stdout, login.stderr);
        return {
          mode,
          command: runtime.command,
          sharedHomeDir: null,
          checkedAt: new Date().toISOString(),
          ok: false,
          exitCode: login.exitCode,
          summary: login.timedOut
            ? "API-key login timed out."
            : "API-key login failed.",
          detail,
          stdout: login.stdout,
          stderr: login.stderr,
        };
      }
    }

    const probe = await runInteractiveChildProcess(
      `codex-instance-probe-${mode}-${Date.now()}`,
      runtime.command,
      ["exec", "--json", "--skip-git-repo-check", "--model", "gpt-5.3-codex", "-"],
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

    const detail = summarizeProbeOutput(probe.stdout, probe.stderr);
    const authError =
      /401 Unauthorized|Missing bearer or basic authentication in header|Incorrect API key provided|invalid_api_key|auth/i.test(
        `${probe.stdout}\n${probe.stderr}`,
      );

    if (probe.timedOut) {
      return {
        mode,
        command: runtime.command,
        sharedHomeDir: mode === "subscription" ? runtime.sharedHomeDir : null,
        checkedAt: new Date().toISOString(),
        ok: false,
        exitCode: probe.exitCode,
        summary: "Connection probe timed out.",
        detail: "Retry the probe. If this keeps happening, inspect the Paperclip runtime environment directly.",
        stdout: probe.stdout,
        stderr: probe.stderr,
      };
    }

    if ((probe.exitCode ?? 1) === 0 && !authError) {
      return {
        mode,
        command: runtime.command,
        sharedHomeDir: mode === "subscription" ? runtime.sharedHomeDir : null,
        checkedAt: new Date().toISOString(),
        ok: true,
        exitCode: probe.exitCode,
        summary: "Connection working.",
        detail: detail && detail !== "connection ok" ? detail : null,
        stdout: probe.stdout,
        stderr: probe.stderr,
      };
    }

    return {
      mode,
      command: runtime.command,
      sharedHomeDir: mode === "subscription" ? runtime.sharedHomeDir : null,
      checkedAt: new Date().toISOString(),
      ok: false,
      exitCode: probe.exitCode,
      summary: authError
        ? "Authentication is not ready."
        : "Connection probe failed.",
      detail,
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  } finally {
    if (isolatedHomeDir) {
      await fs.rm(isolatedHomeDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
