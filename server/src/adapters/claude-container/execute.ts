import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  buildInvocationEnvForLogs,
  renderTemplate,
} from "../utils.js";
import {
  parseClaudeStreamJson,
  describeClaudeFailure,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "@paperclipai/adapter-claude-local/server";

const WORKSPACES_ROOT = path.join(os.homedir(), "paperclip", "workspaces");

export interface DockerRunArgs {
  runId: string;
  agentId: string;
  workspaceDir: string;
  sessionsDir: string;
  skillsDir: string;
  env: Record<string, string>;
  memoryMb: number;
  cpus: number;
  network: string;
  image: string;
}

export function buildDockerArgs(opts: DockerRunArgs): string[] {
  const containerName = `paperclip-run-${opts.runId}`;
  const args: string[] = [
    "run", "--rm",
    "--name", containerName,
    "--network", opts.network,
    "--memory", `${opts.memoryMb}m`,
    "--cpus", String(opts.cpus),
    "--security-opt", "no-new-privileges:true",
    "-i",
    "-v", `${opts.workspaceDir}:/workspace`,
    "-v", `${opts.sessionsDir}:/home/user/.claude`,
    "-v", `${opts.skillsDir}:/home/user/.claude/skills:ro`,
  ];

  for (const [key, value] of Object.entries(opts.env)) {
    args.push("-e", `${key}=${value}`);
  }

  args.push(opts.image);
  return args;
}

interface ContainerResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

async function runContainer(
  dockerArgs: string[],
  stdin: string,
  opts: {
    timeoutSec: number;
    graceSec: number;
    onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
    onSpawn?: (meta: { pid: number; startedAt: string }) => Promise<void>;
  },
): Promise<ContainerResult> {
  return new Promise((resolve) => {
    const child = spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let resolved = false;

    if (opts.onSpawn && child.pid) {
      opts.onSpawn({ pid: child.pid, startedAt: new Date().toISOString() });
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      opts.onLog("stdout", text);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      opts.onLog("stderr", text);
    });

    if (stdin) {
      child.stdin?.write(stdin);
      child.stdin?.end();
    }

    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutTimer =
      opts.timeoutSec > 0
        ? setTimeout(() => {
            timedOut = true;
            spawn("docker", ["stop", "-t", String(opts.graceSec), dockerArgs[dockerArgs.indexOf("--name") + 1]]);
            graceTimer = setTimeout(() => {
              spawn("docker", ["kill", dockerArgs[dockerArgs.indexOf("--name") + 1]]);
            }, (opts.graceSec + 2) * 1000);
          }, opts.timeoutSec * 1000)
        : null;

    child.on("close", (code, signal) => {
      if (resolved) return;
      resolved = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        exitCode: code,
        signal: signal ?? null,
        timedOut,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        exitCode: -1,
        signal: null,
        timedOut: false,
        stdout,
        stderr: stderr + `\n${err.message}`,
      });
    });
  });
}

async function buildSkillsDir(config: Record<string, unknown>): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-container-skills-"));
  const target = path.join(tmp, "skills");
  await fs.mkdir(target, { recursive: true });
  return tmp;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const image = asString(config.image, "nanoclaw-agent:latest");
  const network = asString(config.network, "pkb-net");
  const memoryMb = asNumber(config.memoryMb, 2048);
  const cpus = asNumber(config.cpus, 1.5);
  const model = asString(config.model, "");
  const effort = asString(config.effort, "");
  const maxTurns = asNumber(config.maxTurnsPerRun, 0);
  const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = asStringArray(config.extraArgs);

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const prompt = renderTemplate(promptTemplate, templateData);

  const workspaceDir = path.join(WORKSPACES_ROOT, agent.id);
  const sessionsDir = path.join(workspaceDir, ".claude-sessions");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(sessionsDir, { recursive: true });

  const skillsDir = await buildSkillsDir(config);

  const envConfig = parseObject(config.env);
  const containerEnv: Record<string, string> = {
    HOME: "/home/user",
    ...buildPaperclipEnv(agent),
    PAPERCLIP_RUN_ID: runId,
  };
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") containerEnv[key] = value;
  }
  if (authToken && !containerEnv.PAPERCLIP_API_KEY) {
    containerEnv.PAPERCLIP_API_KEY = authToken;
  }

  const billingType = containerEnv.ANTHROPIC_API_KEY ? "api" as const : "subscription" as const;

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const sessionId = runtimeSessionId || null;

  const claudeArgs: string[] = ["claude", "--print", "-", "--output-format", "stream-json", "--verbose"];
  if (sessionId) claudeArgs.push("--resume", sessionId);
  if (dangerouslySkipPermissions) claudeArgs.push("--dangerously-skip-permissions");
  if (model) claudeArgs.push("--model", model);
  if (effort) claudeArgs.push("--effort", effort);
  if (maxTurns > 0) claudeArgs.push("--max-turns", String(maxTurns));
  if (extraArgs.length > 0) claudeArgs.push(...extraArgs);

  const dockerRunArgs = buildDockerArgs({
    runId,
    agentId: agent.id,
    workspaceDir,
    sessionsDir,
    skillsDir: path.join(skillsDir, "skills"),
    env: containerEnv,
    memoryMb,
    cpus,
    network,
    image,
  });

  dockerRunArgs.push(...claudeArgs);

  if (onMeta) {
    await onMeta({
      adapterType: "claude_container",
      command: "docker",
      cwd: workspaceDir,
      commandArgs: dockerRunArgs,
      env: buildInvocationEnvForLogs(containerEnv, {}),
      prompt,
      context,
    });
  }

  const result = await runContainer(dockerRunArgs, prompt, {
    timeoutSec,
    graceSec,
    onLog,
    onSpawn,
  });

  fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});

  const parsedStream = parseClaudeStreamJson(result.stdout);

  if (result.timedOut) {
    return {
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: true,
      errorMessage: `Container timed out after ${timeoutSec}s`,
      errorCode: "timeout",
    };
  }

  const resolvedSessionId = parsedStream.sessionId ?? sessionId;
  const resolvedSessionParams = resolvedSessionId
    ? { sessionId: resolvedSessionId, cwd: "/workspace" }
    : null;
  const clearSession = parsedStream.resultJson
    ? isClaudeMaxTurnsResult(parsedStream.resultJson)
    : false;

  const errorMessage =
    (result.exitCode ?? 0) === 0
      ? null
      : (parsedStream.resultJson ? describeClaudeFailure(parsedStream.resultJson) : null) ??
        `Container exited with code ${result.exitCode ?? -1}`;

  return {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: false,
    errorMessage,
    usage: parsedStream.usage ?? undefined,
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionParams,
    sessionDisplayId: resolvedSessionId,
    provider: "anthropic",
    biller: "anthropic",
    model: parsedStream.model || model,
    billingType,
    costUsd: parsedStream.costUsd ?? undefined,
    resultJson: parsedStream.resultJson,
    summary: parsedStream.summary || undefined,
    clearSession,
  };
}
