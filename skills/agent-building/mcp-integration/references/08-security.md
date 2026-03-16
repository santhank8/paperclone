# Security Model

## What MCPs Can Access

MCP servers run as child processes spawned by Claude Code, which runs as your user. This means:

- **stdio MCPs have your full user permissions** — if your user can read `/etc/hosts`, a filesystem MCP with broad path access can too
- **HTTP MCPs access whatever the remote server permits** — your Claude Code session can't control what the remote server does internally
- **No sandbox by default** — MCP servers are not containerized or restricted beyond the paths/scopes you configure in `.mcp.json`

## Project vs User Scope Security Implications

**Project scope** (`.mcp.json` committed to repo):
- Visible to all contributors who clone the repo
- All agents assigned to this project see these MCPs
- A broad-access MCP in project scope = broad access for every agent that works on this repo

**User scope** (`~/.claude/mcp.json`):
- Invisible to other contributors and agents
- Travels with you across all projects
- Right place for high-trust personal tools

## Scoping Permissions Correctly

### Filesystem
```json
// BAD — full home directory access
"args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourname"]

// GOOD — only the specific paths needed
"args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourname/projects/myapp/exports", "/tmp"]
```

### GitHub
```
// BAD — classic token with full repo scope
GITHUB_TOKEN = ghp_fullrepoaccess...

// GOOD — fine-grained token scoped to specific repos with minimum permissions
GITHUB_TOKEN = github_pat_11A...  # Read-only on specific repos
```

### Postgres
```sql
-- BAD — superuser or application connection string
DATABASE_URL=postgresql://admin:password@localhost/mydb

-- GOOD — read-only user scoped to this project
DATABASE_URL=postgresql://claude_readonly:readonlypass@localhost/mydb
```

## Permission Requests in Claude Code UI

When Claude calls an MCP tool for the first time in a session, Claude Code may show a permission prompt depending on your settings. This is the same trust model as built-in tool calls.

You can configure MCP tool trust levels in Claude Code settings. Default is to prompt for approval on the first call to each MCP tool — subsequent calls in the same session don't re-prompt.

## Recommendations

| Concern | Recommendation |
|---|---|
| Shared repo with sensitive MCPs | Use user scope, not project scope |
| Multi-agent environments | Scope permissions to minimum needed per repo |
| Postgres access | Create a read-only DB user for Claude, separate from app credentials |
| GitHub tokens | Fine-grained tokens over classic tokens |
| Custom MCPs with internal APIs | Use short-lived tokens or API keys specific to Claude, rotatable independently |
| External HTTP MCPs | Review the provider's data handling — your queries and their results go through their server |

## What Claude Code Cannot Do Through MCPs

- **Call another agent's MCPs** — each Claude Code session has its own MCP connections
- **Persist state in MCP servers across sessions** — stdio servers restart each session
- **Bypass Claude Code's tool call permission system** — MCP tool calls still go through Claude Code's approval flow

The attack surface is: what can the MCP server reach? Limit that, and you've limited the risk.
