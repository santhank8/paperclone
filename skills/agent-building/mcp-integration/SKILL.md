---
name: mcp-integration
description: Configure MCPs in Claude Code to connect agents to databases, GitHub, file systems, and web services. Use when setting up `.mcp.json`, choosing between project vs user scope, debugging MCP connection failures, or building a custom MCP server. Triggers on: "set up MCP", "add MCP to Claude Code", ".mcp.json", "MCP not connecting", "custom MCP server", "GitHub MCP setup", "MCP authentication", "connect Claude to database", "extend Claude Code with tools", "MCP debug", "stdio vs HTTP MCP", "mcp.json config". NOT for: Claude Desktop MCP configuration, MCP server hosting/deployment to production, MCP OAuth server-side implementation.
---

# MCP Integration for Claude Code

Claude Code has native MCP support. You don't need McPorter, API Gateway, or any wrapper. A single `.mcp.json` file gives your agent access to databases, GitHub, filesystems, and custom project tools.

## Quick Entry

| Goal | Reference |
|---|---|
| Why MCPs differ from built-in tools | [01-what-is-mcp.md](references/01-what-is-mcp.md) |
| `.mcp.json` schema and project vs user scope | [02-config.md](references/02-config.md) |
| Choose stdio vs HTTP transport | [03-transport.md](references/03-transport.md) |
| Top 5 MCPs with exact copy-paste configs | [04-top-5-mcps.md](references/04-top-5-mcps.md) |
| Auth without leaking secrets | [05-auth.md](references/05-auth.md) |
| Build a custom MCP in 40 lines | [06-custom-mcp.md](references/06-custom-mcp.md) |
| Debug failures with `/mcp` | [07-debugging.md](references/07-debugging.md) |
| Security model and permission scoping | [08-security.md](references/08-security.md) |

## 60-Second Setup (GitHub MCP)

**1. Create `.mcp.json` in your project root:**

```json
{
  "mcpServers": {
    "github": {
      "command": "bunx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**2. Set your token (never hardcode it):**

```bash
export GITHUB_TOKEN=ghp_your_token_here
# Add to ~/.zshrc to persist
```

**3. Restart Claude Code. Run `/mcp`** — should show `github: connected`.

## stdio vs HTTP: 30-Second Decision

| Factor | stdio | HTTP |
|---|---|---|
| Server location | Local machine | Remote/cloud |
| Config key | `command` + `args` | `url` |
| Auth | Env vars | OAuth / Bearer tokens |
| Typical MCPs | filesystem, github, postgres | Hosted SaaS services |
| Latency | Milliseconds | Network-dependent |

**Rule:** Start with stdio. Use HTTP only when the service doesn't run locally.

## Project vs User Scope

| Scope | Location | Use When |
|---|---|---|
| Project | `.mcp.json` in repo root | Shared team MCPs — check this into git |
| User | `~/.claude/mcp.json` | Personal tools, keys unique to you |

**Never put personal API keys in project-scoped `.mcp.json`.** Use `${ENV_VAR}` references — they resolve from the shell environment, not the config file.

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I'll use McPorter — it's easier to install" | McPorter wraps the same `.mcp.json` system. You get abstraction without understanding the transport — one failure you can't diagnose. |
| "I'll hardcode the API key just to test quickly" | Quick tests become committed code. `${ENV_VAR}` takes 10 more seconds. Use it from the start. |
| "stdio seems limiting — I'll use HTTP for everything" | stdio MCPs are lower latency, no network dependency, simpler auth. Use HTTP only when the service is remote. |
| "The MCP isn't connecting — I'll remove it and try another" | `/mcp` shows the exact error. Read it. 80% of failures are wrong path, missing env var, or wrong transport. See [07-debugging.md](references/07-debugging.md). |
| "I'll put everything in project `.mcp.json` for simplicity" | Personal API keys in project scope = committed credentials for every contributor. Use user scope for personal MCPs. |
| "Building a custom MCP sounds complex" | 40 lines of TypeScript, one tool, stdio transport. The SDK handles the protocol. See [06-custom-mcp.md](references/06-custom-mcp.md). |

## Prerequisites

- **bun / bunx** — required for `@modelcontextprotocol/*` server packages
- **Node.js / npx** — also works if bun is not installed
- GitHub MCP: personal access token (classic or fine-grained)
- Postgres MCP: connection string with appropriate permissions
- Brave Search MCP: free API key from Brave Search API dashboard
