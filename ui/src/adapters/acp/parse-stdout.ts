import type { TranscriptEntry } from "../types";

export function parseAcpStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);

    // --- Structured events from our ACP adapter ---
    if (parsed.type === "acp:initialized") {
      const name = parsed.agent?.name ?? "ACP Agent";
      return [{ kind: "system", ts, text: `Connected to ${name}` }];
    }
    if (parsed.type === "acp:tool_call") {
      return [{ kind: "tool_call", ts, name: parsed.name ?? "unknown", input: parsed.input }];
    }
    if (parsed.type === "acp:tool_update") {
      return [{ kind: "tool_result", ts, toolUseId: parsed.toolCallId ?? "", content: String(parsed.content ?? ""), isError: false }];
    }
    if (parsed.type === "acp:turn_end") {
      return [{ kind: "system", ts, text: "Turn complete" }];
    }
    if (parsed.type === "acp:notification") {
      // Skip noisy Kiro extension notifications in the transcript
      if (parsed.method?.startsWith("_kiro.dev/")) return [];
      return [{ kind: "system", ts, text: JSON.stringify(parsed) }];
    }

    // --- Raw JSON-RPC session/update notifications (ACP spec format) ---
    if (parsed.jsonrpc === "2.0" && parsed.method === "session/update") {
      const update = parsed.params?.update;
      if (!update) return [];
      switch (update.sessionUpdate) {
        case "agent_message_chunk": {
          const text = update.content?.text ?? "";
          if (!text) return [];
          return [{ kind: "assistant", ts, text }];
        }
        case "tool_call":
          return [{ kind: "tool_call", ts, name: update.title ?? "tool", input: undefined }];
        case "tool_call_update": {
          if (update.status === "completed" && update.content) {
            const output = Array.isArray(update.content)
              ? update.content.map((c: { content?: { text?: string } }) => c.content?.text ?? "").join("")
              : String(update.content);
            return [{ kind: "tool_result", ts, toolUseId: update.toolCallId ?? "", content: output, isError: false }];
          }
          // in_progress updates — skip to avoid noise
          return [];
        }
        case "turn_end":
          return [{ kind: "system", ts, text: "Turn complete" }];
        default:
          return [];
      }
    }

    // Skip Kiro extension notifications (_kiro.dev/*)
    if (parsed.jsonrpc === "2.0" && parsed.method?.startsWith("_kiro.dev/")) {
      return [];
    }

    // JSON-RPC responses (initialize, session/new, session/prompt) — skip
    if (parsed.jsonrpc === "2.0" && "id" in parsed) {
      return [];
    }
  } catch {
    // Not JSON
  }

  return [{ kind: "stdout", ts, text: line }];
}

