import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  buildPaperclipEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_OLLAMA_LOCAL_MODEL } from "../index.js";

function firstNonEmptyLine(text: string): string | null {
  if (!text) return null;
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const command = asString(config.command, "ollama");
  const model = asString(config.model, DEFAULT_OLLAMA_LOCAL_MODEL);

  const timeoutSec = asNumber(config.timeoutSec, 1800);
  const graceSec = asNumber(config.graceSec, 30);
  const instructionsFilePath = asString(config.instructionsFilePath, "");
  const extraArgs = asStringArray(config.extraArgs) || [];

  const parsedEnv = (config.env as Record<string, unknown>) || {};
  const envRecords: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) envRecords[k] = v;
  }
  for (const [k, v] of Object.entries(parsedEnv)) {
    if (v !== undefined && v !== null) envRecords[k] = String(v);
  }
  const defaultEnv = envRecords;

  const paperclipEnv = buildPaperclipEnv(agent);
  const env = { ...defaultEnv, ...paperclipEnv };

  const commandNotes: string[] = [];

  const cwd = (runtime as { cwd?: string }).cwd || process.cwd();
  try {
    await ensureAbsoluteDirectory(cwd, {
      createIfMissing: true,
    });
  } catch (err) {
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }

  const instructionsResult = await (async () => {
    if (!instructionsFilePath) return { prefix: "", notes: [] };
    const absPath = path.resolve(instructionsFilePath);
    try {
      const content = await import("node:fs/promises").then((m) => m.readFile(absPath, "utf-8"));
      const instructionsDir = path.dirname(absPath);
      return {
        prefix: `<paperclip-instructions>\n${content}\n</paperclip-instructions>\n\n`,
        notes: [
          `Loaded agent instructions from ${instructionsFilePath}`,
          `Prepended instructions to stdin prompt.`,
        ],
      };
    } catch {
      return {
        prefix: "",
        notes: [`Configured instructionsFilePath ${instructionsFilePath} could not be read; continuing without injected instructions.`],
      };
    }
  })();

  const renderedPrompt = renderTemplate(promptTemplate, {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  });

  const proactiveAddition = config.proactivePrompting ? `

[PROACTIVE AGENT INSTRUCTION]
When you have successfully completed your current task, do not just stop. You must proactively ask for the next task or notify the master model/user that you are ready for more work.
` : "";

  const prompt = `${instructionsResult.prefix}${renderedPrompt}${proactiveAddition}`;

  const args = ["run", model, ...extraArgs];

  if (onMeta) {
    await onMeta({
      adapterType: "ollama_local",
      command,
      cwd,
      commandNotes: [...commandNotes, ...instructionsResult.notes],
      commandArgs: [...args, `<prompt ${prompt.length} chars>`],
      env: redactEnvForLogs(env),
      prompt,
      context,
    });
  }

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    stdin: prompt,
    timeoutSec,
    graceSec,
    onLog,
  });

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  const fallbackErrorMessage =
    firstNonEmptyLine(proc.stderr) ||
    `Ollama exited with code ${proc.exitCode ?? -1}`;

  // We emit a single summary or text stream response if possible, since Ollama doesn't output json streams.
  // Actually, runChildProcess already buffers stdout and stderr.
  // We can just construct a summary from stdout.
  const summary = proc.stdout.trim() || null;

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: (proc.exitCode ?? 0) === 0 ? null : fallbackErrorMessage,
    provider: "ollama",
    model,
    resultJson: {
      stdout: proc.stdout,
      stderr: proc.stderr,
    },
    summary,
  };
}
