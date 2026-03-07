import chalk from "chalk";

export function printAcpStdoutEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  try {
    const parsed = JSON.parse(line);

    if (parsed.type === "acp:initialized") {
      const name = parsed.agent?.name ?? "ACP Agent";
      console.log(chalk.dim(`[ACP] Connected to ${name}`));
      return;
    }
    if (parsed.type === "acp:message") {
      if (parsed.role === "agent" || parsed.role === "assistant") {
        console.log(chalk.cyan(parsed.text));
      } else {
        console.log(chalk.gray(`[${parsed.role}] ${parsed.text}`));
      }
      return;
    }
    if (parsed.type === "acp:tool_call") {
      console.log(chalk.yellow(`[tool] ${parsed.name}`));
      return;
    }
    if (parsed.type === "acp:tool_update") {
      console.log(chalk.dim(String(parsed.content ?? "")));
      return;
    }
    if (parsed.type === "acp:artifact") {
      console.log(chalk.green(parsed.text ?? ""));
      return;
    }
    if (parsed.type === "acp:status") {
      console.log(chalk.dim(`[ACP] Status: ${parsed.state}`));
      return;
    }

    // Raw JSON-RPC
    if (parsed.jsonrpc === "2.0" && parsed.method === "session/notification") {
      const p = parsed.params ?? {};
      if (p.type === "AgentMessageChunk") {
        process.stdout.write(String(p.text ?? p.content ?? ""));
        return;
      }
      if (p.type === "ToolCall") {
        console.log(chalk.yellow(`[tool] ${p.name ?? p.toolName}`));
        return;
      }
      if (p.type === "TurnEnd") {
        console.log(chalk.dim("[ACP] Turn complete"));
        return;
      }
    }
  } catch {
    // Not JSON
  }

  console.log(line);
}
