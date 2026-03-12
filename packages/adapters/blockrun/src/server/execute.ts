import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  buildPaperclipEnv,
} from "@paperclipai/adapter-utils/server-utils";
import { signX402Payment, getWalletAddress } from "./x402.js";

// Routing mode → model mapping
const ROUTING_MODELS: Record<string, string> = {
  fast: "google/gemini-2.5-flash",
  balanced: "openai/gpt-4o",
  powerful: "anthropic/claude-opus-4.6",
  cheap: "deepseek/deepseek-chat",
  reasoning: "openai/o3",
};

function resolveApiUrl(config: Record<string, unknown>): string {
  const explicit = asString(config.apiUrl, "");
  if (explicit) return explicit.replace(/\/+$/, "");
  const network = asString(config.network, "mainnet");
  return network === "testnet"
    ? "https://testnet.blockrun.ai/api"
    : "https://blockrun.ai/api";
}

function resolveModel(config: Record<string, unknown>): string {
  const model = asString(config.model, "");
  if (model) return model;
  const mode = asString(config.routingMode, "balanced");
  return ROUTING_MODELS[mode] ?? ROUTING_MODELS.balanced!;
}

function extractProvider(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : "blockrun";
}

/**
 * Fetch issue details from the Paperclip API when running inside a heartbeat.
 * The heartbeat context only contains issueId — the title/body must be fetched.
 */
async function fetchIssueContent(
  agent: { id: string; companyId: string },
  issueId: string,
): Promise<{ title: string; body: string } | null> {
  try {
    const env = buildPaperclipEnv(agent);
    const apiUrl = env.PAPERCLIP_API_URL;
    if (!apiUrl) return null;
    const res = await fetch(
      `${apiUrl}/api/issues/${issueId}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: asString(data.title, ""),
      body: asString(data.description, "") || asString(data.body, ""),
    };
  } catch {
    return null;
  }
}

/**
 * Build the messages array for the BlockRun chat completion request.
 *
 * Merges:
 *  1. Optional user-defined system prompt from adapter config
 *  2. Paperclip task context (structured)
 *  3. The actual task prompt / wake text / issue content
 */
async function buildMessages(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
  agent: { id: string; companyId: string },
): Promise<Array<{ role: string; content: string }>> {
  const messages: Array<{ role: string; content: string }> = [];

  // User-defined system prompt
  const systemPrompt = asString(config.systemPrompt, "");
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Paperclip context as structured system message
  const contextKeys = [
    "companyName",
    "companyMission",
    "agentTitle",
    "agentRole",
    "goalAncestry",
    "issueTitle",
    "issueBody",
    "issueLabels",
    "projectName",
  ];
  const contextParts: string[] = [];
  for (const key of contextKeys) {
    const val = context[key];
    if (typeof val === "string" && val.length > 0) {
      contextParts.push(`${key}: ${val}`);
    } else if (Array.isArray(val) && val.length > 0) {
      contextParts.push(`${key}: ${val.join(", ")}`);
    }
  }
  if (contextParts.length > 0) {
    messages.push({
      role: "system",
      content: `You are an AI agent in the Paperclip orchestration platform.\n\n${contextParts.join("\n")}`,
    });
  }

  // Known Paperclip wake trigger strings that are NOT actual prompts.
  // These are internal event types passed as wakeText by the heartbeat system.
  const WAKE_TRIGGER_STRINGS = new Set([
    "issue_checked_out",
    "issue_assigned",
    "issue_created",
    "issue_updated",
    "heartbeat",
    "ping",
    "manual",
    "callback",
    "system",
    "automation",
    "timer",
    "on_demand",
    "assignment",
  ]);

  const rawWakeText = asString(context.wakeText, "");
  const wakeText = WAKE_TRIGGER_STRINGS.has(rawWakeText.toLowerCase())
    ? ""
    : rawWakeText;

  // If we have an issueId, always try to fetch the real issue content first.
  // The heartbeat context often only passes the issueId, not the full body.
  let issuePrompt = "";
  const issueId =
    asString(context.issueId, "") || asString(context.taskId, "");
  if (issueId) {
    const issue = await fetchIssueContent(agent, issueId);
    if (issue) {
      const parts: string[] = [];
      if (issue.title) parts.push(`Task: ${issue.title}`);
      if (issue.body) parts.push(issue.body);
      issuePrompt = parts.join("\n\n");
    }
  }

  // Primary prompt — prefer fetched issue content, then wakeText, then
  // explicit prompt field, then issueBody from context snapshot.
  let prompt =
    issuePrompt ||
    wakeText ||
    asString(context.prompt, "") ||
    asString(context.issueBody, "");

  // Also check wakeReason as a last resort
  if (!prompt) {
    const wakeReason = asString(context.wakeReason, "");
    if (!WAKE_TRIGGER_STRINGS.has(wakeReason.toLowerCase())) {
      prompt = wakeReason;
    }
  }

  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  // Conversation history if present
  const history = context.conversationHistory;
  if (Array.isArray(history)) {
    for (const msg of history) {
      const m = parseObject(msg);
      const role = asString(m.role, "");
      const content = asString(m.content, "");
      if ((role === "user" || role === "assistant") && content) {
        messages.push({ role, content });
      }
    }
  }

  return messages;
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = ctx.config;
  const apiUrl = resolveApiUrl(config);
  const model = resolveModel(config);
  const provider = extractProvider(model);
  const network = asString(config.network, "mainnet") as
    | "mainnet"
    | "testnet";
  const privateKey = asString(config.privateKey, "");
  const maxTokens = asNumber(config.maxTokens, 4096);
  const temperature = asNumber(config.temperature, 0.7);
  const timeoutSec = asNumber(config.timeoutSec, 120);

  const messages = await buildMessages(config, ctx.context, ctx.agent);

  const hasUserMessage = messages.some((m) => m.role === "user");
  if (!hasUserMessage) {
    await ctx.onLog("stderr", "[blockrun] No prompt or context provided\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No prompt or context to send to the model",
      errorCode: "NO_PROMPT",
    };
  }

  // Log invocation metadata
  if (ctx.onMeta) {
    await ctx.onMeta({
      adapterType: "blockrun",
      command: `POST ${apiUrl}/v1/chat/completions`,
      context: { model, network, maxTokens, temperature },
    });
  }

  const wallet = privateKey ? getWalletAddress(privateKey) : "(none)";
  await ctx.onLog(
    "stdout",
    `[blockrun] Model: ${model} | Network: ${network} | Wallet: ${wallet}\n`,
  );
  await ctx.onLog(
    "stdout",
    `[blockrun] Sending ${messages.length} message(s), max_tokens=${maxTokens}\n`,
  );

  const chatUrl = `${apiUrl}/v1/chat/completions`;
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  const startMs = Date.now();

  try {
    // ------- First request -------
    const firstRes = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });

    let response: Record<string, unknown>;

    if (firstRes.status === 402) {
      // ---- x402 payment flow ----
      if (!privateKey) {
        const msg =
          "Paid model requires a wallet private key. " +
          "Configure privateKey in adapter settings, or use a free model (nvidia/gpt-oss-*).";
        await ctx.onLog("stderr", `[blockrun] ${msg}\n`);
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: msg,
          errorCode: "PAYMENT_REQUIRED",
        };
      }

      const paymentHeader = firstRes.headers.get("Payment-Required");
      if (!paymentHeader) {
        throw new Error(
          "402 response missing Payment-Required header",
        );
      }

      await ctx.onLog(
        "stdout",
        "[blockrun] Payment required — signing x402 authorization...\n",
      );

      const maxPaymentUsd = asNumber(config.maxPaymentUsd, 1.0);
      const paymentSignature = await signX402Payment(
        paymentHeader,
        privateKey,
        network,
        maxPaymentUsd,
      );

      // ------- Second request with payment -------
      const secondRes = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": paymentSignature,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutSec * 1000),
      });

      if (!secondRes.ok) {
        const errorBody = await secondRes.text().catch(() => "");
        throw new Error(
          `BlockRun API ${secondRes.status}: ${errorBody.slice(0, 500)}`,
        );
      }

      response = (await secondRes.json()) as Record<string, unknown>;

      const receipt =
        secondRes.headers.get("X-Payment-Receipt") ?? "";
      if (receipt) {
        await ctx.onLog(
          "stdout",
          `[blockrun] Payment settled — tx: ${receipt}\n`,
        );
      }
    } else if (firstRes.ok) {
      // Free model — no payment needed
      await ctx.onLog(
        "stdout",
        "[blockrun] Free model — no payment required\n",
      );
      response = (await firstRes.json()) as Record<string, unknown>;
    } else {
      const errorBody = await firstRes.text().catch(() => "");
      throw new Error(
        `BlockRun API ${firstRes.status}: ${errorBody.slice(0, 500)}`,
      );
    }

    // ------- Parse response -------
    const choices = Array.isArray(response.choices)
      ? response.choices
      : [];
    const firstChoice = parseObject(
      choices[0] as Record<string, unknown> | undefined,
    );
    const message = parseObject(firstChoice.message);
    const content = asString(message.content, "");
    const finishReason = asString(firstChoice.finish_reason, "stop");

    const usage = parseObject(response.usage);
    const inputTokens = asNumber(usage.prompt_tokens, 0);
    const outputTokens = asNumber(usage.completion_tokens, 0);

    const actualModel = asString(response.model, model);
    const actualProvider = extractProvider(actualModel);

    // Estimate cost (tokens × pricing)
    // This is approximate — the actual cost was settled on-chain.
    // A rough heuristic: most models cost ~$1-15/M input, ~$2-60/M output.
    // We leave costUsd as null and let Paperclip use the on-chain data if available.
    let costUsd: number | null = null;
    if (inputTokens > 0 || outputTokens > 0) {
      // Fall back to a conservative estimate based on provider
      const estimates: Record<string, [number, number]> = {
        openai: [2.5, 10.0],
        anthropic: [3.0, 15.0],
        google: [1.25, 5.0],
        deepseek: [0.27, 1.1],
        xai: [3.0, 15.0],
        nvidia: [0, 0],
      };
      const [inputRate, outputRate] = estimates[actualProvider] ?? [
        3.0, 15.0,
      ];
      costUsd =
        (inputTokens / 1_000_000) * inputRate +
        (outputTokens / 1_000_000) * outputRate;
    }

    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);

    // Log assistant response
    if (content) {
      await ctx.onLog(
        "stdout",
        `[blockrun:event] run=${ctx.runId} stream=assistant data=${JSON.stringify({ text: content })}\n`,
      );
    }

    await ctx.onLog(
      "stdout",
      `[blockrun] Completed in ${elapsedSec}s | ${inputTokens} in / ${outputTokens} out tokens` +
        (costUsd !== null ? ` | ~$${costUsd.toFixed(4)}` : "") +
        ` | finish: ${finishReason}\n`,
    );

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: { inputTokens, outputTokens },
      provider: actualProvider,
      model: actualModel,
      billingType: "api",
      costUsd,
      summary: content.length > 500 ? content.slice(0, 497) + "..." : content,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    const timedOut =
      message.includes("TimeoutError") ||
      message.includes("abort") ||
      message.includes("timed out");

    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
    await ctx.onLog(
      "stderr",
      `[blockrun] Failed after ${elapsedSec}s: ${message}\n`,
    );

    return {
      exitCode: 1,
      signal: null,
      timedOut,
      errorMessage: message,
      errorCode: timedOut ? "TIMEOUT" : "API_ERROR",
    };
  }
}
