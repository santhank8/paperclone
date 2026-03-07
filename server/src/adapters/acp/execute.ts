import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { AdapterAgent, AdapterExecutionContext, AdapterExecutionResult, UsageSummary } from "../types.js";
import { asString, asNumber, asStringArray, parseObject, buildPaperclipEnv, ensurePathInEnv, redactEnvForLogs, renderTemplate } from "../utils.js";

// ---------------------------------------------------------------------------
// ACP (Agent Client Protocol) adapter — execute
//
// ACP is a stdio-based JSON-RPC 2.0 protocol (like MCP) where the client
// spawns an agent process and communicates over stdin/stdout.
//
// Lifecycle (per ACP spec — https://agentclientprotocol.com/protocol/prompt-turn):
//   1. Spawn the ACP agent command (e.g. `kiro-cli acp`)
//   2. Send `initialize` request → wait for response
//   3. Send `session/new` or `session/load` request
//   4. Send `session/prompt` request with prompt content array
//   5. Agent streams `session/update` notifications (agent_message_chunk,
//      tool_call, tool_call_update, plan, etc.)
//   6. Agent responds to session/prompt with { stopReason: "end_turn" }
//   7. Close stdin and wait for process exit
// ---------------------------------------------------------------------------

function buildAcpPrompt(agent: AdapterAgent, context: Record<string, unknown>): string {
  const a = agent as Record<string, unknown>;
  const name = asString(a.name, "Agent");
  const title = asString(a.title, "");
  const capabilities = asString(a.capabilities, "");
  const issueTitle = asString(context.issueTitle, "");
  const issueDescription = asString(context.issueDescription, "");

  const lines: string[] = [];
  lines.push(`You are ${name}${title ? `, the ${title}` : ""}.`);
  if (capabilities) {
    lines.push(`Your capabilities: ${capabilities}`);
  }
  lines.push("");

  if (issueTitle) {
    lines.push("## Your current task");
    lines.push(issueTitle);
    if (issueDescription) {
      lines.push("");
      lines.push(issueDescription);
    }
  } else {
    lines.push("You have no specific task assigned. Check the project directory for relevant work and report what you find.");
  }

  lines.push("");
  lines.push("Work in the current directory. Be thorough and produce concrete output.");
  return lines.join("\n");
}

let nextRpcId = 1;
function rpcId(): number { return nextRpcId++; }

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

function sendRequest(proc: ChildProcess, id: number, method: string, params: Record<string, unknown>): void {
  proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
}


export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, onLog, onMeta } = ctx;

  const command = asString(config.command, "kiro-cli");
  const args = asStringArray(config.args).length > 0 ? asStringArray(config.args) : ["acp"];
  const cwd = asString(config.cwd, process.cwd());
  const timeoutSec = asNumber(config.timeoutSec, 0);
  const configuredModel = asString(config.model, "");
  const envConfig = parseObject(config.env);

  const sessionId = ctx.runtime.sessionId;

  // Build environment
  const env: Record<string, string> = {
    ...buildPaperclipEnv(agent),
  };
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  const fullEnv = ensurePathInEnv({ ...process.env, ...env }) as Record<string, string>;

  if (onMeta) {
    await onMeta({
      adapterType: "acp",
      command,
      cwd,
      commandArgs: args,
      commandNotes: [
        sessionId ? `Resuming session: ${sessionId}` : "New session",
        "Protocol: ACP (JSON-RPC 2.0 over stdio)",
      ],
      env: redactEnvForLogs(env),
    });
  }

  // --- Spawn the ACP agent process ---
  const proc = spawn(command, args, {
    cwd,
    env: fullEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Track pending RPC responses
  const pendingRequests = new Map<number, {
    resolve: (res: JsonRpcResponse) => void;
    reject: (err: Error) => void;
  }>();

  // State
  let acpSessionId: string | null = sessionId;
  const usage: UsageSummary = { inputTokens: 0, outputTokens: 0 };
  let model: string | null = null;
  let summary: string | null = null;
  let errorMessage: string | null = null;

  // Process exit promise
  let resolveExit: ((result: { exitCode: number | null; signal: string | null }) => void) | null = null;
  const exitPromise = new Promise<{ exitCode: number | null; signal: string | null }>((resolve) => {
    resolveExit = resolve;
  });
  proc.on("close", (code, signal) => {
    resolveExit?.({ exitCode: code, signal: signal ?? null });
  });

  // --- Parse stdout as newline-delimited JSON-RPC ---
  const rl = createInterface({ input: proc.stdout! });

  rl.on("line", (line) => {
    // Log raw line for visibility
    void onLog("stdout", line + "\n");

    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // Not JSON — skip
    }

    // Response to a request we sent
    if ("id" in msg && msg.id != null) {
      const pending = pendingRequests.get(msg.id as number);
      if (pending) {
        pendingRequests.delete(msg.id as number);
        pending.resolve(msg as JsonRpcResponse);
      }
      return;
    }

    // Notification from the agent
    if ("method" in msg) {
      void handleNotification(msg as JsonRpcNotification);
    }
  });

  async function handleNotification(notif: JsonRpcNotification): Promise<void> {
    const params = notif.params ?? {};

    // Kiro sends "session/update" with params.update.sessionUpdate
    if (notif.method === "session/update") {
      const update = params.update as Record<string, unknown> | undefined;
      if (!update) return;
      const updateType = update.sessionUpdate as string | undefined;
      switch (updateType) {
        case "agent_message_chunk": {
          const content = update.content as Record<string, unknown> | undefined;
          const text = content?.text ?? "";
          if (text) summary = (summary ?? "") + String(text);
          break;
        }
        case "tool_call": {
          await onLog("stdout", JSON.stringify({
            type: "acp:tool_call",
            toolCallId: update.toolCallId,
            name: update.title ?? update.name,
          }) + "\n");
          break;
        }
        case "tool_call_update": {
          await onLog("stdout", JSON.stringify({
            type: "acp:tool_update",
            toolCallId: update.toolCallId,
            kind: update.kind,
          }) + "\n");
          break;
        }
        case "turn_end": {
          if (update.usage && typeof update.usage === "object") {
            const u = update.usage as Record<string, unknown>;
            if (typeof u.inputTokens === "number") usage.inputTokens += u.inputTokens;
            if (typeof u.outputTokens === "number") usage.outputTokens += u.outputTokens;
          }
          if (typeof update.model === "string") model = update.model;
          break;
        }
        default: {
          await onLog("stdout", JSON.stringify({ type: "acp:notification", updateType, ...params }) + "\n");
        }
      }
      return;
    }

    // Log other notification methods (Kiro extensions, etc.)
    await onLog("stdout", JSON.stringify({ type: "acp:notification", method: notif.method, ...params }) + "\n");
  }

  // --- Collect stderr ---
  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    void onLog("stderr", text);
  });

  // --- Send RPC request and wait for response ---
  function request(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const id = rpcId();
      const timer = timeoutSec > 0
        ? setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`ACP request ${method} timed out (${timeoutSec}s)`));
          }, timeoutSec * 1000)
        : null;

      pendingRequests.set(id, {
        resolve: (res) => {
          if (timer) clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
      });

      sendRequest(proc, id, method, params);
    });
  }

  // --- ACP Protocol Flow ---
  try {
    // 1. Initialize (request — expects response)
    const initRes = await request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: "paperclip", version: "1.0.0" },
    });

    if (initRes.error) {
      throw new Error(`ACP initialize failed: ${initRes.error.message}`);
    }

    await onLog("stdout", JSON.stringify({
      type: "acp:initialized",
      agent: initRes.result?.agentInfo,
      capabilities: initRes.result?.agentCapabilities,
    }) + "\n");

    // 2. Create or load session (request — expects response)
    if (acpSessionId) {
      const loadRes = await request("session/load", { sessionId: acpSessionId, cwd, mcpServers: [] });
      if (loadRes.error) {
        await onLog("stderr", `ACP session/load failed (${loadRes.error.message}), creating new session\n`);
        const newRes = await request("session/new", { cwd, mcpServers: [] });
        if (newRes.error) throw new Error(`ACP session/new failed: ${newRes.error.message}`);
        acpSessionId = (newRes.result?.sessionId as string) ?? null;
      }
    } else {
      const newRes = await request("session/new", { cwd, mcpServers: [] });
      if (newRes.error) throw new Error(`ACP session/new failed: ${newRes.error.message}`);
      acpSessionId = (newRes.result?.sessionId as string) ?? null;
    }

    // 2b. Set model if configured
    if (configuredModel) {
      const modelRes = await request("session/set_model", {
        sessionId: acpSessionId,
        modelId: configuredModel,
      });
      if (modelRes.error) {
        await onLog("stderr", `ACP session/set_model warning: ${modelRes.error.message}\n`);
      } else {
        await onLog("stdout", JSON.stringify({ type: "acp:model_set", modelId: configuredModel }) + "\n");
      }
    }

    // 3. Build prompt — ACP agents don't have system prompt injection like
    // Claude's --append-system-prompt-file, so we build a rich prompt that
    // includes role, capabilities, and task context.
    const customTemplate = asString(config.promptTemplate, "");
    let prompt: string;
    if (customTemplate) {
      prompt = renderTemplate(customTemplate, {
        agentId: agent.id,
        companyId: agent.companyId,
        runId,
        company: { id: agent.companyId },
        agent,
        run: { id: runId, source: "on_demand" },
        context: ctx.context,
      });
    } else {
      prompt = buildAcpPrompt(agent, ctx.context);
    }

    // Send prompt as request — per ACP spec, the response to session/prompt
    // signals turn end with { result: { stopReason: "end_turn" } }.
    // All session/update notifications stream before the response arrives.
    const promptRes = await request("session/prompt", {
      sessionId: acpSessionId,
      prompt: [{ type: "text", text: prompt }],
    });

    if (promptRes.error) {
      throw new Error(`ACP session/prompt failed: ${promptRes.error.message}`);
    }

    // The prompt response itself signals turn completion
    const stopReason = (promptRes.result?.stopReason as string) ?? "unknown";
    await onLog("stdout", JSON.stringify({ type: "acp:turn_end", stopReason }) + "\n");

  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Close stdin to signal we're done, then wait for process exit
  try { proc.stdin?.end(); } catch { /* ignore */ }

  // Give the process a few seconds to exit gracefully
  const graceTimeout = new Promise<{ exitCode: number | null; signal: string | null }>((resolve) =>
    setTimeout(() => {
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      resolve({ exitCode: 1, signal: "SIGTERM" });
    }, 10_000)
  );

  const exitResult = await Promise.race([exitPromise, graceTimeout]);

  rl.close();

  // ACP agents may exit with non-zero after stdin close (broken pipe).
  // If the prompt completed successfully, normalize exit code to 0.
  const exitCode = !errorMessage ? 0 : exitResult.exitCode;

  return {
    exitCode,
    signal: exitResult.signal,
    timedOut: errorMessage?.includes("timed out") ?? false,
    errorMessage,
    usage: usage.inputTokens > 0 || usage.outputTokens > 0 ? usage : undefined,
    model,
    sessionId: acpSessionId,
    sessionParams: acpSessionId ? { sessionId: acpSessionId } : null,
    sessionDisplayId: acpSessionId,
    summary: summary?.slice(0, 500) ?? null,
  };
}
