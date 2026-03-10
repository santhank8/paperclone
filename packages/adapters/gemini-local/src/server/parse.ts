import type { UsageSummary } from "@paperclipai/adapter-utils";
import { asString, asNumber, parseObject, parseJson } from "@paperclipai/adapter-utils/server-utils";

const GEMINI_AUTH_REQUIRED_RE = /(?:not\s+logged\s+in|please\s+log\s+in|authenticate|authentication\s+required|unauthorized)/i;
const URL_RE = /(https?:\/\/[^\s'"`<>()[\]{};,!?]+[^\s'"`<>()[\]{};,!.?:]+)/gi;

// Token pricing per 1M tokens (as of 2026)
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.10, output: 0.40 },
  "gemini-2.5-pro": { input: 2.00, output: 12.00 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-2.0-flash-lite": { input: 0.10, output: 0.40 },
  "gemini-1.5-pro": { input: 1.25, output: 5.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
};

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const prices = PRICING[model] || PRICING["gemini-2.5-flash"];
  const inputCost = (inputTokens / 1_000_000) * prices.input;
  const outputCost = (outputTokens / 1_000_000) * prices.output;
  return inputCost + outputCost;
}

export function parseGeminiStreamJson(stdout: string) {
  let sessionId: string | null = null;
  let model = "";
  let finalResult: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;

    const type = asString(event.type, "");

    // Handle different event types based on Gemini CLI output format
    if (type === "system" || type === "systemMessage") {
      sessionId = asString(event.session_id, sessionId ?? "") || sessionId;
      model = asString(event.model, model);
      const text = asString(event.text, "");
      if (text) assistantTexts.push(text);
      continue;
    }

    if (type === "message" || type === "assistant" || type === "model") {
      sessionId = asString(event.session_id, sessionId ?? "") || sessionId;
      const text = asString(event.text, "") || asString(event.message, "");
      if (text) assistantTexts.push(text);
      continue;
    }

    if (type === "response" || type === "result") {
      finalResult = event;
      sessionId = asString(event.session_id, sessionId ?? "") || sessionId;
    }

    // Also check for content at top level
    const content = asString(event.content, "");
    if (content && !finalResult) {
      assistantTexts.push(content);
    }
  }

  // Extract usage metadata if available in final result
  let usage: UsageSummary = { inputTokens: 0, outputTokens: 0 };
  let costUsd: number | null = null;

  if (finalResult) {
    const usageMetadata = parseObject(finalResult.usageMetadata || finalResult.usage);
    const promptTokens = asNumber(usageMetadata.promptTokenCount, 0) ||
                       asNumber(usageMetadata.prompt_tokens, 0) ||
                       asNumber(usageMetadata.inputTokenCount, 0) ||
                       asNumber(usageMetadata.input_tokens, 0);
    const completionTokens = asNumber(usageMetadata.candidatesTokenCount, 0) ||
                           asNumber(usageMetadata.completion_tokens, 0) ||
                           asNumber(usageMetadata.outputTokenCount, 0) ||
                           asNumber(usageMetadata.output_tokens, 0);
    const totalTokens = asNumber(usageMetadata.totalTokenCount, 0) ||
                      asNumber(usageMetadata.total_tokens, 0);

    usage = {
      inputTokens: promptTokens,
      outputTokens: completionTokens,
    };

    // Calculate cost if we have token counts
    if (promptTokens > 0 || completionTokens > 0) {
      const modelId = model || asString(finalResult.model, "gemini-2.5-flash");
      costUsd = calculateCostUsd(modelId, promptTokens, completionTokens);
    }
  }

  if (!finalResult) {
    return {
      sessionId,
      model,
      costUsd: null as number | null,
      usage: null as UsageSummary | null,
      summary: assistantTexts.join("\n\n").trim(),
      resultJson: null as Record<string, unknown> | null,
    };
  }

  const summary = asString(
    finalResult.result ||
    finalResult.text ||
    finalResult.content ||
    finalResult.message ||
    assistantTexts.join("\n\n"),
    ""
  ).trim();

  return {
    sessionId,
    model,
    costUsd,
    usage,
    summary,
    resultJson: finalResult,
  };
}

function extractGeminiErrorMessages(parsed: Record<string, unknown>): string[] {
  const raw = Array.isArray(parsed.errors) ? parsed.errors : [];
  const messages: string[] = [];

  for (const entry of raw) {
    if (typeof entry === "string") {
      const msg = entry.trim();
      if (msg) messages.push(msg);
      continue;
    }

    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const msg = asString(obj.message, "") || asString(obj.error, "") || asString(obj.code, "");
    if (msg) {
      messages.push(msg);
      continue;
    }

    try {
      messages.push(JSON.stringify(obj));
    } catch {
      // skip non-serializable entry
    }
  }

  return messages;
}

export function extractGeminiLoginUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match || match.length === 0) return null;
  for (const rawUrl of match) {
    const cleaned = rawUrl.replace(/[\])}.!,?;:'\"]+$/g, "");
    if (cleaned.includes("gemini") || cleaned.includes("google") || cleaned.includes("auth")) {
      return cleaned;
    }
  }
  return match[0]?.replace(/[\])}.!,?;:'\"]+$/g, "") ?? null;
}

export function detectGeminiAuthRequired(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { requiresAuth: boolean; loginUrl: string | null } {
  const resultText = asString(input.parsed?.result, "").trim();
  const messages = [resultText, ...extractGeminiErrorMessages(input.parsed ?? {}), input.stdout, input.stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const requiresAuth = messages.some((line) => GEMINI_AUTH_REQUIRED_RE.test(line));
  return {
    requiresAuth,
    loginUrl: extractGeminiLoginUrl([input.stdout, input.stderr].join("\n")),
  };
}

export function describeGeminiFailure(parsed: Record<string, unknown>): string | null {
  const resultText = asString(parsed.result, "").trim();
  const errors = extractGeminiErrorMessages(parsed);

  let detail = resultText;
  if (!detail && errors.length > 0) {
    detail = errors[0] ?? "";
  }

  const parts = ["Gemini run failed"];
  if (detail) parts.push(detail);
  return parts.length > 1 ? parts.join(": ") : null;
}