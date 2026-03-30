import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  renderTemplate,
  joinPromptSections,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_GITHUB_MODEL } from "../models.js";

const GITHUB_MODELS_API = "https://models.inference.ai.azure.com";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

function resolveGithubToken(
  configEnv: Record<string, unknown>,
  adapterEnv: Record<string, string | undefined>,
): string {
  const fromConfig =
    typeof configEnv.GITHUB_TOKEN === "string" && configEnv.GITHUB_TOKEN.trim().length > 0
      ? configEnv.GITHUB_TOKEN.trim()
      : null;
  const fromProcess =
    typeof adapterEnv.GITHUB_TOKEN === "string" && adapterEnv.GITHUB_TOKEN.trim().length > 0
      ? adapterEnv.GITHUB_TOKEN.trim()
      : null;
  return fromConfig ?? fromProcess ?? "";
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  const configEnv = parseObject(config.env);
  const githubToken = resolveGithubToken(configEnv, process.env as Record<string, string | undefined>);

  if (!githubToken) {
    await onLog(
      "stderr",
      "[copilot-local] GITHUB_TOKEN is not set. Set it in adapter env or server host environment.\n",
    );
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "GITHUB_TOKEN is not configured",
      errorCode: "missing_github_token",
      billingType: "subscription",
      biller: "github",
    };
  }

  const model = asString(config.model, DEFAULT_GITHUB_MODEL).trim() || DEFAULT_GITHUB_MODEL;
  const maxTokens = asNumber(config.maxTokens, 4096);
  const timeoutSec = asNumber(config.timeoutSec, 120);
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();

  // Build prompt from template + context
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). {{context.wakeReason}}",
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
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const userPrompt = joinPromptSections([sessionHandoffNote, renderedPrompt]);

  // Build messages
  const messages: ChatMessage[] = [];

  // System prompt from instructions file or default
  let systemPrompt: string | null = null;
  if (instructionsFilePath) {
    try {
      const { promises: fs } = await import("node:fs");
      systemPrompt = await fs.readFile(instructionsFilePath, "utf-8");
    } catch (err) {
      await onLog(
        "stderr",
        `[copilot-local] Could not read instructions file "${instructionsFilePath}": ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  if (onMeta) {
    await onMeta({
      adapterType: "copilot_local",
      command: `POST ${GITHUB_MODELS_API}/chat/completions`,
      prompt: userPrompt,
      promptMetrics: { promptChars: userPrompt.length },
      context: { model, maxTokens },
    });
  }

  await onLog("stdout", `[copilot-local] Starting chat completion with model: ${model}\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  let inputTokens = 0;
  let outputTokens = 0;
  let fullOutput = "";
  let timedOut = false;

  try {
    const response = await fetch(`${GITHUB_MODELS_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      await onLog(
        "stderr",
        `[copilot-local] API request failed with status ${response.status}: ${errorBody}\n`,
      );
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `GitHub Models API returned HTTP ${response.status}`,
        errorCode: "api_error",
        billingType: "subscription",
        biller: "github",
      };
    }

    const body = response.body;
    if (!body) {
      throw new Error("Response body is null");
    }

    // Parse SSE stream
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice("data: ".length);
        if (data === "[DONE]") continue;

        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;

          // Accumulate usage from the final usage chunk
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
            outputTokens = chunk.usage.completion_tokens ?? outputTokens;
          }

          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullOutput += delta;
            await onLog("stdout", delta);
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    // Flush decoder
    const remaining = decoder.decode();
    if (remaining) {
      buffer += remaining;
    }

    await onLog("stdout", "\n");

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      billingType: "subscription",
      biller: "github",
      provider: "github",
      model,
      usage:
        inputTokens > 0 || outputTokens > 0
          ? { inputTokens, outputTokens }
          : undefined,
      summary: fullOutput.slice(0, 500).replace(/\s+/g, " ").trim() || null,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      timedOut = true;
      await onLog("stderr", "[copilot-local] Request timed out.\n");
      return {
        exitCode: 1,
        signal: null,
        timedOut: true,
        errorMessage: "Request timed out",
        errorCode: "timeout",
        billingType: "subscription",
        biller: "github",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[copilot-local] Unexpected error: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut,
      errorMessage: message,
      errorCode: "unexpected_error",
      billingType: "subscription",
      biller: "github",
    };
  } finally {
    clearTimeout(timer);
  }
}
