/**
 * Shared OpenAI-compatible API execution utilities.
 * Used by DeepSeek, Qwen, Moonshot and other OpenAI-compatible adapters.
 */
import type {
  AdapterExecutionResult,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentTestContext,
  UsageSummary,
  AdapterBillingType,
} from "./types.js";

export interface OpenAiCompatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  provider: string;
  biller: string;
  adapterType: string;
}

export interface OpenAiCompatCallbacks {
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: unknown) => Promise<void>;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface SSEDelta {
  content?: string;
  reasoning_content?: string;
}

interface SSEChoice {
  delta?: SSEDelta;
  finish_reason?: string | null;
}

interface SSEChunk {
  id?: string;
  choices?: SSEChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    prompt_cache_hit_tokens?: number;
  };
  model?: string;
}

function emitJsonLine(kind: string, data: Record<string, unknown>): string {
  return JSON.stringify({ type: kind, ...data });
}

async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload) as SSEChunk;
        } catch {
          // skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function executeOpenAiCompatChat(
  config: OpenAiCompatConfig,
  messages: ChatMessage[],
  callbacks: OpenAiCompatCallbacks,
): Promise<AdapterExecutionResult> {
  const { baseUrl, apiKey, model, maxTokens, temperature, provider, biller, adapterType } = config;
  const { onLog } = callbacks;
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (maxTokens != null && maxTokens > 0) body.max_tokens = maxTokens;
  if (temperature != null) body.temperature = temperature;

  // Emit init event
  await onLog("stdout", emitJsonLine("system", { subtype: "init", model, session_id: "" }));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await onLog("stderr", emitJsonLine("error", { error: `网络请求失败: ${msg}` }));
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `网络请求失败: ${msg}`,
      provider,
      biller,
      model,
      billingType: "api" as AdapterBillingType,
    };
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
    } catch { /* ignore */ }
    const msg = `API 返回错误 ${response.status}: ${errorDetail}`;
    await onLog("stderr", emitJsonLine("error", { error: msg }));
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: msg,
      errorCode: `http_${response.status}`,
      provider,
      biller,
      model,
      billingType: "api" as AdapterBillingType,
    };
  }

  if (!response.body) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "响应体为空",
      provider,
      biller,
      model,
      billingType: "api" as AdapterBillingType,
    };
  }

  let fullContent = "";
  let fullReasoning = "";
  let usage: UsageSummary = { inputTokens: 0, outputTokens: 0 };
  let resolvedModel = model;

  for await (const chunk of parseSSEStream(response.body)) {
    if (chunk.model) resolvedModel = chunk.model;

    if (chunk.choices && chunk.choices.length > 0) {
      const delta = chunk.choices[0]?.delta;
      if (delta) {
        if (delta.content) {
          fullContent += delta.content;
          await onLog("stdout", emitJsonLine("assistant", {
            message: { text: delta.content },
            delta: true,
          }));
        }
        if (delta.reasoning_content) {
          fullReasoning += delta.reasoning_content;
          await onLog("stdout", emitJsonLine("thinking", {
            text: delta.reasoning_content,
            delta: true,
          }));
        }
      }
    }

    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        cachedInputTokens: chunk.usage.cached_tokens ?? chunk.usage.prompt_cache_hit_tokens ?? 0,
      };
    }
  }

  // Emit result event
  await onLog("stdout", emitJsonLine("result", {
    subtype: "result",
    result: fullContent,
    is_error: false,
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_input_tokens: usage.cachedInputTokens ?? 0,
    },
  }));

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    usage,
    provider,
    biller,
    model: resolvedModel,
    billingType: "api" as AdapterBillingType,
    summary: fullContent.slice(0, 500),
    resultJson: {
      content: fullContent,
      ...(fullReasoning ? { reasoning: fullReasoning } : {}),
    },
  };
}

export async function testOpenAiCompatApiKey(
  baseUrl: string,
  apiKey: string,
  model: string,
  adapterType: string,
  envKeyName: string,
): Promise<AdapterEnvironmentTestResult> {
  const ts = new Date().toISOString();

  if (!apiKey) {
    return {
      adapterType,
      status: "fail",
      checks: [{
        code: "api_key_missing",
        level: "error",
        message: `${envKeyName} 未设置`,
        hint: `请在环境变量或智能体配置中设置 ${envKeyName}`,
      }],
      testedAt: ts,
    };
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.ok) {
      return {
        adapterType,
        status: "pass",
        checks: [{
          code: "api_key_valid",
          level: "info",
          message: `${envKeyName} 有效，API 连接正常`,
        }],
        testedAt: ts,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        adapterType,
        status: "fail",
        checks: [{
          code: "api_key_invalid",
          level: "error",
          message: `${envKeyName} 无效 (${response.status})`,
          hint: `请检查 ${envKeyName} 是否正确`,
        }],
        testedAt: ts,
      };
    }

    // Other status codes (e.g. 429 rate limit) - key is valid but there's an issue
    return {
      adapterType,
      status: "warn",
      checks: [{
        code: "api_status",
        level: "warn",
        message: `API 返回状态 ${response.status}`,
        detail: `密钥可能有效，但 API 返回了非预期状态码`,
      }],
      testedAt: ts,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      adapterType,
      status: "fail",
      checks: [{
        code: "network_error",
        level: "error",
        message: `无法连接到 API: ${msg}`,
        hint: `请检查网络连接和 API 基础地址是否正确`,
      }],
      testedAt: ts,
    };
  }
}
