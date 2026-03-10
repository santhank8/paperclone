import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseGeminiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Handle system/init events
  if (type === "system" || type === "systemMessage") {
    return [
      {
        kind: "init",
        ts,
        model: typeof parsed.model === "string" ? parsed.model : "unknown",
        sessionId: typeof parsed.session_id === "string" ? parsed.session_id : "",
      },
    ];
  }

  // Handle message/assistant events
  if (type === "message" || type === "assistant" || type === "model") {
    const text = typeof parsed.text === "string"
      ? parsed.text
      : typeof parsed.content === "string"
        ? parsed.content
        : typeof parsed.message === "string"
          ? parsed.message
          : "";
    if (text) {
      return [{ kind: "assistant", ts, text }];
    }
    return [{ kind: "stdout", ts, text: line }];
  }

  // Handle tool calls (if present)
  if (type === "tool" || type === "tool_use" || type === "function_call") {
    const name = typeof parsed.name === "string" ? parsed.name : "unknown";
    const input = parsed.input ?? parsed.arguments ?? {};
    return [{
      kind: "tool_call",
      ts,
      name,
      input: typeof input === "object" ? input as Record<string, unknown> : {},
    }];
  }

  // Handle tool results
  if (type === "tool_result" || type === "tool_use_result") {
    const toolUseId = typeof parsed.tool_use_id === "string"
      ? parsed.tool_use_id
      : typeof parsed.id === "string"
        ? parsed.id
        : "";
    const isError = parsed.is_error === true;
    let text = "";
    if (typeof parsed.content === "string") {
      text = parsed.content;
    } else if (typeof parsed.result === "string") {
      text = parsed.result;
    }
    return [{ kind: "tool_result", ts, toolUseId, content: text, isError }];
  }

  // Handle result/final response
  if (type === "response" || type === "result") {
    const usageMetadata = asRecord(parsed.usageMetadata) ?? asRecord(parsed.usage) ?? {};
    const inputTokens = asNumber(usageMetadata.promptTokenCount) ||
                       asNumber(usageMetadata.prompt_tokens) ||
                       asNumber(usageMetadata.inputTokenCount) ||
                       asNumber(usageMetadata.input_tokens);
    const outputTokens = asNumber(usageMetadata.candidatesTokenCount) ||
                        asNumber(usageMetadata.completion_tokens) ||
                        asNumber(usageMetadata.outputTokenCount) ||
                        asNumber(usageMetadata.output_tokens);
    const costUsd = asNumber(parsed.costUsd) || asNumber(parsed.total_cost_usd);
    const isError = parsed.is_error === true || parsed.error === true;
    const text = typeof parsed.result === "string"
      ? parsed.result
      : typeof parsed.text === "string"
        ? parsed.text
        : typeof parsed.content === "string"
          ? parsed.content
          : "";
    return [{
      kind: "result",
      ts,
      text,
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      costUsd,
      subtype: "",
      isError,
      errors: [],
    }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
