import pc from "picocolors";

function asErrorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const obj = value as Record<string, unknown>;
  const message =
    (typeof obj.message === "string" && obj.message) ||
    (typeof obj.error === "string" && obj.error) ||
    (typeof obj.code === "string" && obj.code) ||
    "";
  if (message) return message;
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
}

export function printGeminiStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Handle system/init events
  if (type === "system" || type === "systemMessage") {
    const model = typeof parsed.model === "string" ? parsed.model : "unknown";
    const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : "";
    console.log(pc.blue(`Gemini initialized (model: ${model}${sessionId ? `, session: ${sessionId}` : ""})`));
    return;
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
    if (text) console.log(pc.green(`assistant: ${text}`));
    return;
  }

  // Handle tool calls
  if (type === "tool" || type === "tool_use" || type === "function_call") {
    const name = typeof parsed.name === "string" ? parsed.name : "unknown";
    console.log(pc.yellow(`tool_call: ${name}`));
    if (parsed.input !== undefined) {
      console.log(pc.gray(JSON.stringify(parsed.input, null, 2)));
    }
    return;
  }

  // Handle result/final response
  if (type === "response" || type === "result") {
    const usageMetadata = typeof parsed.usageMetadata === "object" && parsed.usageMetadata !== null
      ? (parsed.usageMetadata as Record<string, unknown>)
      : typeof parsed.usage === "object" && parsed.usage !== null
        ? (parsed.usage as Record<string, unknown>)
        : {};
    const input = Number(usageMetadata.promptTokenCount ?? usageMetadata.prompt_tokens ?? usageMetadata.inputTokenCount ?? usageMetadata.input_tokens ?? 0);
    const output = Number(usageMetadata.candidatesTokenCount ?? usageMetadata.completion_tokens ?? usageMetadata.outputTokenCount ?? usageMetadata.output_tokens ?? 0);
    const cost = Number(parsed.costUsd ?? parsed.total_cost_usd ?? 0);
    const isError = parsed.is_error === true || parsed.error === true;
    const resultText = typeof parsed.result === "string"
      ? parsed.result
      : typeof parsed.text === "string"
        ? parsed.text
        : typeof parsed.content === "string"
          ? parsed.content
          : "";
    if (resultText) {
      console.log(pc.green("result:"));
      console.log(resultText);
    }
    if (isError) {
      const errorMsg = asErrorText(parsed);
      if (errorMsg) {
        console.log(pc.red(`gemini_result: error=${errorMsg}`));
      }
    }
    console.log(
      pc.blue(
        `tokens: in=${Number.isFinite(input) ? input : 0} out=${Number.isFinite(output) ? output : 0} cost=$${Number.isFinite(cost) ? cost.toFixed(6) : "0.000000"}`,
      ),
    );
    return;
  }

  if (debug) {
    console.log(pc.gray(line));
  }
}