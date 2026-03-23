import fs from "node:fs/promises";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  joinPromptSections,
  parseObject,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import {
  chatWithOllama,
  ensureOllamaModelConfiguredAndAvailable,
  normalizeOllamaBaseUrl,
} from "./models.js";

function firstNonEmptyLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function stringifyContext(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function readInstructionsFile(candidate: string, cwd: string | null) {
  const trimmed = candidate.trim();
  if (!trimmed) return "";
  const resolvedPath = path.isAbsolute(trimmed)
    ? trimmed
    : cwd
      ? path.resolve(cwd, trimmed)
      : trimmed;
  return (await fs.readFile(resolvedPath, "utf8")).trim();
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta } = ctx;

  const parsedConfig = parseObject(config);
  const model = asString(parsedConfig.model, "").trim();
  const allowUndiscoveredModel = parsedConfig.allowUndiscoveredModel === true;
  const timeoutSec = Math.max(30, asNumber(parsedConfig.timeoutSec, 180));
  const promptTemplate = asString(
    parsedConfig.promptTemplate,
    [
      "You are Paperclip agent {{agent.name}} ({{agent.id}}).",
      "You are running through the experimental Ollama local adapter.",
      "You cannot execute tools or edit files in this adapter.",
      "Write a concise markdown Issue comment for the current task.",
      "If required information is missing, ask one focused clarifying question instead of guessing.",
    ].join("\n"),
  );
  const runtimeSessionId = runtime.sessionDisplayId ?? runtime.sessionId ?? "";
  const issue = parseObject(context.paperclipIssue);
  const workingContext = parseObject(context.paperclipWorkspace);
  const workingDirectory = asString(
    parsedConfig.cwd,
    asString(workingContext.cwd, ""),
  ).trim();
  let baseUrl = "";

  try {
    baseUrl = normalizeOllamaBaseUrl(parsedConfig.baseUrl ?? parsedConfig.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Ollama base URL.";
    await onLog("stderr", `[paperclip] ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorCode: "ollama_base_url_invalid",
      errorMessage: message,
      provider: "ollama",
      biller: "local",
      model,
      billingType: "fixed",
      costUsd: 0,
    };
  }

  try {
    await ensureOllamaModelConfiguredAndAvailable({
      model,
      baseUrl,
      allowUndiscoveredModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Configured Ollama model is unavailable.";
    await onLog("stderr", `[paperclip] ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorCode: "ollama_model_invalid",
      errorMessage: message,
      provider: "ollama",
      biller: "local",
      model,
      billingType: "fixed",
      costUsd: 0,
    };
  }

  let instructionsText = "";
  const instructionsFilePath = asString(parsedConfig.instructionsFilePath, "").trim();
  if (instructionsFilePath) {
    try {
      instructionsText = await readInstructionsFile(instructionsFilePath, workingDirectory || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read instructions file.";
      await onLog("stderr", `[paperclip] ${message}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorCode: "ollama_instructions_read_failed",
        errorMessage: message,
        provider: "ollama",
        biller: "local",
        model,
        billingType: "fixed",
        costUsd: 0,
      };
    }
  }

  const templateData = {
    agent,
    run: { id: runId },
    runtime: {
      sessionId: runtimeSessionId,
      taskKey: runtime.taskKey,
    },
    issue,
    context,
  };

  const systemPrompt = joinPromptSections([
    renderTemplate(promptTemplate, templateData).trim(),
    instructionsText ? `Additional instructions:\n${instructionsText}` : null,
  ]);

  const userPrompt = joinPromptSections([
    issue.id
      ? [
          "Current Paperclip issue:",
          `- Identifier: ${asString(
            issue.identifier,
            typeof issue.id === "string" ? issue.id : "(unknown issue)",
          )}`,
          `- Title: ${asString(issue.title, "(untitled issue)")}`,
          issue.description ? `- Description:\n${asString(issue.description, "").trim()}` : "- Description: (none)",
        ].join("\n")
      : "This run is not attached to a Paperclip issue.",
    runtime.taskKey ? `Task key: ${runtime.taskKey}` : null,
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? `Wake reason: ${context.wakeReason.trim()}`
      : null,
    workingDirectory ? `Working directory: ${workingDirectory}` : null,
    [
      "Relevant runtime context:",
      stringifyContext({
        issueId: context.issueId ?? null,
        commentId: context.commentId ?? null,
        approvalId: context.approvalId ?? null,
        linkedIssueIds: Array.isArray(context.issueIds) ? context.issueIds : [],
        workspace: context.paperclipWorkspace ?? null,
      }),
    ].join("\n"),
    [
      "Write the exact markdown comment body to post back to Paperclip.",
      "Constraints:",
      "- Be concise and specific.",
      "- Do not claim you edited files, ran tests, or inspected code unless the provided context explicitly says so.",
      "- Do not wrap the whole response in code fences.",
    ].join("\n"),
  ]);

  await onMeta?.({
    adapterType: "ollama_local",
    command: "POST /api/chat",
    prompt: userPrompt,
    context: {
      baseUrl,
      model,
      issueId: context.issueId ?? null,
    },
  });
  await onLog("stdout", `${JSON.stringify({ type: "system", text: `Calling Ollama model ${model} at ${baseUrl}` })}\n`);

  try {
    const response = await chatWithOllama({
      baseUrl,
      model,
      timeoutMs: timeoutSec * 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const reply = response.message?.content?.trim() ?? "";
    if (!reply) {
      throw new Error("Ollama returned an empty response.");
    }

    await onLog("stdout", `${JSON.stringify({ type: "assistant", text: reply })}\n`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: {
        inputTokens: asNumber(response.prompt_eval_count, 0),
        outputTokens: asNumber(response.eval_count, 0),
      },
      provider: "ollama",
      biller: "local",
      model: asString(response.model, model),
      billingType: "fixed",
      costUsd: 0,
      resultJson: {
        reply,
        done: response.done ?? null,
        doneReason: response.done_reason ?? null,
        totalDuration: response.total_duration ?? null,
        loadDuration: response.load_duration ?? null,
        promptEvalDuration: response.prompt_eval_duration ?? null,
        evalDuration: response.eval_duration ?? null,
      },
      summary: firstNonEmptyLine(reply),
      issueComment: reply,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ollama request failed.";
    await onLog("stderr", `[paperclip] ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: /timed out/i.test(message),
      errorCode: /timed out/i.test(message) ? "ollama_timeout" : "ollama_request_failed",
      errorMessage: message,
      provider: "ollama",
      biller: "local",
      model,
      billingType: "fixed",
      costUsd: 0,
    };
  }
}
