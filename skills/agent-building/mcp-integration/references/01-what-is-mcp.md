# What Is MCP and Why Does It Matter in Claude Code

## Built-in Tools vs MCPs

Claude Code ships with a fixed set of built-in tools: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`. These always work — no config, no auth, no setup.

MCPs (Model Context Protocol servers) extend Claude's reach beyond what's built in. They're external processes that expose tools via a standard protocol. Claude Code spawns them (stdio) or connects to them (HTTP), then makes their tools available alongside the built-in ones.

**The key difference:**

| | Built-in tools | MCP tools |
|---|---|---|
| Availability | Always present | Require config + startup |
| Latency | Zero | Process spawn or network |
| Failure modes | Rarely fail | Can crash, timeout, auth-fail |
| What they reach | Local filesystem, shell | External APIs, databases, browsers |
| Config required | None | `.mcp.json` entry |

## Why Not Just Use Bash + curl?

You can. But MCPs give Claude Code:

1. **Typed tool calls** — Claude knows exactly what parameters the tool accepts, not a raw shell string
2. **Auth encapsulation** — credentials live in the MCP process, not exposed in shell commands
3. **Resource access** — MCPs can expose *resources* (readable documents) in addition to *tools* (executable actions)
4. **Composability** — an agent can discover and call MCP tools without knowing anything about the underlying API

## The Trade-Off You're Accepting

Every MCP you add is an external dependency:

- It can fail to start (wrong path, missing dependency)
- It can fail at runtime (expired token, rate limit, network)
- It adds startup time to Claude Code sessions

**Rule:** Add an MCP when it gives Claude access to a system that would otherwise require multi-step Bash gymnastics. Don't add MCPs for things the built-in Bash + Read/Write tools already handle well.
