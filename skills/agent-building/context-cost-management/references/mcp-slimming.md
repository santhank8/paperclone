# MCP Slimming: Deep Reference

## The 81-Tool Calculation

Community report (HN thread, 400+ comments): a developer ran Claude Code with 81 enabled MCP tools. Token overhead before the first message: 143,000 tokens.

**Why this happens:** MCP tool definitions are injected into every context window automatically. The server doesn't know which tools you'll use. All are included upfront.

**Typical studio/power-user MCP stack:**
```
filesystem (15–20 tools)      → ~20,000 tokens
github (8–12 tools)           → ~12,000 tokens
postgres/database (5–8 tools) → ~8,000 tokens
puppeteer/browser (6–10 tools)→ ~10,000 tokens
slack (4–6 tools)             → ~6,000 tokens
custom servers (5–10 tools)   → ~10,000 tokens
─────────────────────────────────────────────
Total: 40–60 tools → ~66,000 tokens overhead
```

That's 33% of a 200K context window before you type anything.

---

## Context Mode: The 98% Fix

Context mode = lazy loading. The server sends tool names only; full definitions load on demand.

**Token reduction:**
- Eager (normal): 1,500 tokens per tool × 60 tools = 90,000 tokens
- Context mode: ~50 tokens per tool name × 60 tools = 3,000 tokens
- **Reduction: 97%**

**Enable context mode in `.mcp.json`:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "--context-mode", "/path/to/root"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github", "--context-mode"]
    }
  }
}
```

**Not all servers support `--context-mode`.** Check the server's README. If unsupported, use project-scoping instead.

---

## Project-Scoped MCP Config

**Global config** (`~/.claude/settings.json`): loads for every session in every project.
**Project config** (`.claude/settings.json` in project root): overrides global for that project only.

**Pattern — disable globally, enable per project:**

Global (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "postgres": { "disabled": true },
    "puppeteer": { "disabled": true }
  }
}
```

Project where you need it (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "postgres": { "disabled": false }
  }
}
```

Only the servers you need load in each project. Default overhead: near zero.

---

## Audit Procedure: Slimming Your Stack

**Step 1 — List all active servers:**
```
Settings → MCP Servers → note all enabled
```

**Step 2 — Usage audit:**
For each server, ask: "In the last 5 working sessions in this project, did I invoke any tool from this server?" If no → disable for this project.

**Step 3 — Tool-level audit (within heavy servers):**
Some servers expose 20+ tools but you use 3. Check if the server supports selective tool exposure (some do via config). If not: context mode or project-disable.

**Step 4 — Measure before/after:**
Open a fresh session. Check the context meter immediately (before you type anything). That's your MCP overhead baseline. After slimming, recheck.

**Target:** < 10% of context window consumed by MCP definitions before first message.

---

## Common MCP Servers and Slimming Strategy

| Server | Tools | Strategy |
|--------|-------|----------|
| `@modelcontextprotocol/server-filesystem` | 15–20 | Enable context mode; restrict root path |
| `@modelcontextprotocol/server-github` | 8–12 | Enable context mode; project-scope |
| Database servers | 5–8 | Project-scope only; disable globally |
| Browser/puppeteer | 6–10 | Project-scope only; disable globally |
| Slack/communication | 4–6 | Project-scope only; rarely needed in code sessions |
| Custom/local servers | varies | Audit each; many are abandoned after initial setup |

**The hidden culprit:** custom MCP servers installed during experiments that you forgot about. Run `cat ~/.claude/settings.json | grep -A3 mcpServers` to find them all.
