# MCP Slimming

## When to Use

- "My MCP tools are consuming everything"
- "My context is full before I even start"
- "How do I reduce MCP token overhead?"
- You have many MCP servers enabled globally

## Steps

**The 98% token reduction technique:** context mode = lazy loading. Tool names are listed; definitions load only when invoked.

**Enable context mode** in `.mcp.json`:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "--context-mode", "/path"]
    }
  }
}
```

Not all servers support context mode. For those that don't: **disable globally, enable per-project only when needed.**

**Project-scoped disable** (`.claude/settings.json` in project root):
```json
{
  "mcpServers": {
    "heavy-server": { "disabled": true }
  }
}
```

**Audit your active servers:** Which did you actually invoke this week? Disable the rest.

## Verification

- Context usage drops measurably in the next session
- You've identified which servers support context mode and which need project-scoping

## Reference

See `../references/mcp-slimming.md` for: the 81-tool calculation, context mode setup per common server, project vs. global config rules, and a worked audit.
