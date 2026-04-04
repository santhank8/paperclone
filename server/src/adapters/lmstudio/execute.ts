import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:1234";
const DEFAULT_MODEL = "qwen/qwen3.5-35b-a3b";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_SYSTEM_PROMPT =
  "You are a practical local AI worker inside Paperclip. Be concise, accurate, and action-oriented.";

function extractPrompt(context: Record<string, unknown>): string {
  const candidates: (string | undefined)[] = [
    asStringMaybe(context.prompt),
    asStringMaybe(context.message),
    asStringMaybe(context.text),
    asStringMaybe(context.commentText),
    asStringMaybe((context.issue as Record<string, unknown> | undefined)?.title),
    asStringMaybe((context.issue as Record<string, unknown> | undefined)?.description),
  ];
  const found = candidates.find((v) => v && v.trim().length > 0);
  if (found) return found.trim();
  return `You are an AI agent invoked by Paperclip. Analyze the following context and respond helpfully.\n\n${JSON.stringify(context, null, 2)}`;
}

function asStringMaybe(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function truncate(v: string, max = 500): string {
  return v.length > max ? v.slice(0, max) + "…" : v;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, context, onLog } = ctx;
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = asString(config.model, DEFAULT_MODEL);
  const temperature = asNumber(config.temperature, DEFAULT_TEMPERATURE);
  const systemPrompt = asString(config.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  const timeoutMs = asNumber(config.timeoutMs, 120_000);

  const prompt = extractPrompt(parseObject(context));

  await onLog("stdout", `[lmstudio] model=${model} baseUrl=${baseUrl}`);

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    const body = await res.text();
    if (!res.ok) {
      throw new Error(`LM Studio returned ${res.status}: ${body.slice(0, 300)}`);
    }

    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw new Error(`LM Studio returned non-JSON: ${body.slice(0, 300)}`);
    }

    const choices = (json?.choices as Array<Record<string, unknown>> | undefined) ?? [];
    const msg = parseObject(choices[0]?.message as unknown);
    const result = asString(msg.content, "").trim();
    const usage = json?.usage ?? null;

    const summary = truncate(result);

    await onLog("stdout", `[lmstudio] result: ${summary}`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary,
      resultJson: { summary, result, model, usage },
    };
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") {
      return { exitCode: 1, signal: null, timedOut: true, errorMessage: `LM Studio timed out after ${timeoutMs}ms` };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
