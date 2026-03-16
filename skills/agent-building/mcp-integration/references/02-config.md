# The `.mcp.json` Config File

## File Locations

| Scope | Path | Committed? | Visible to |
|---|---|---|---|
| Project | `{repo-root}/.mcp.json` | Yes — check it in | All agents and users on this repo |
| User | `~/.claude/mcp.json` | No — personal only | You only, across all projects |

Claude Code merges both files. If the same server name appears in both, project scope wins.

## Schema

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### stdio server fields

| Field | Required | Description |
|---|---|---|
| `command` | Yes | Executable to run (`npx`, `node`, `python`, `bun`) |
| `args` | No | Arguments array passed to the command |
| `env` | No | Environment variables injected into the process |

### HTTP server fields

```json
{
  "mcpServers": {
    "my-remote-service": {
      "url": "https://mcp.myservice.com/v1",
      "headers": {
        "Authorization": "Bearer ${MY_SERVICE_TOKEN}"
      }
    }
  }
}
```

| Field | Required | Description |
|---|---|---|
| `url` | Yes | HTTP endpoint for the MCP server |
| `headers` | No | Request headers (use env var references for auth) |

## Env Var References

Use `${VAR_NAME}` syntax. Claude Code resolves these from the shell environment at startup — the literal string never appears in the file.

```json
"env": {
  "GITHUB_TOKEN": "${GITHUB_TOKEN}",
  "DATABASE_URL": "${DATABASE_URL}"
}
```

**Set these in your shell profile** (`~/.zshrc`, `~/.bashrc`) or a gitignored `.env` file. Never hardcode values in `.mcp.json`.

## Full Example: Project Config with Multiple Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp", "/Users/me/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

## When to Use Each Scope

**Project scope** (`.mcp.json` in repo root):
- MCPs specific to this codebase (your project's database, its GitHub repo)
- MCPs the whole team needs for this project
- Any MCP you want reproducible — same tools on every developer's machine

**User scope** (`~/.claude/mcp.json`):
- Your personal GitHub token (different from teammates' tokens)
- Filesystem access to paths outside the project
- MCPs you use across all projects (web search, personal note-taking)
