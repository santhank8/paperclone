# stdio vs HTTP Transport

## How stdio Works

Claude Code runs your MCP server as a child process. Communication happens over stdin/stdout using JSON-RPC. The process starts when Claude Code launches and stays alive for the session.

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["./my-mcp-server/index.js"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

**What happens:**
1. Claude Code runs `node ./my-mcp-server/index.js` with the env vars injected
2. The process reads JSON-RPC requests from stdin
3. The process writes responses to stdout
4. Claude Code discovers available tools from the process

## How HTTP Works

Claude Code connects to an already-running server at a URL. No process is spawned — Claude Code just makes HTTP requests.

```json
{
  "mcpServers": {
    "my-service": {
      "url": "https://mcp.myservice.com/v1",
      "headers": {
        "Authorization": "Bearer ${SERVICE_TOKEN}"
      }
    }
  }
}
```

**What happens:**
1. Claude Code sends HTTP POST requests to the URL
2. Server responds with tool definitions and execution results
3. Auth is handled via headers (Bearer token, API key, etc.)

## Decision Table

| Situation | Use |
|---|---|
| MCP server is an npm package you install locally | **stdio** |
| MCP server is a Python script in your repo | **stdio** |
| You're building a custom MCP for this project | **stdio** |
| Service requires OAuth (Notion, Slack, Google) | **HTTP** |
| Service runs on a remote server you don't control | **HTTP** |
| You need to share one MCP server across multiple Claude Code sessions | **HTTP** |
| You're just getting started and want simplest setup | **stdio** |

## Common Mistakes

**Mixing up the config shape:**
```json
// WRONG — stdio config with url field
{
  "command": "npx",
  "url": "http://localhost:3000"  // url is for HTTP only
}

// WRONG — HTTP config with command field
{
  "url": "http://localhost:3000",
  "command": "node"  // command is for stdio only
}
```

**Using HTTP for a local process:**
HTTP requires the server to already be running. If you have a local process, use stdio — Claude Code will start it for you.

**Forgetting that stdio servers are ephemeral:**
Each Claude Code session spawns a fresh server process. State that lives in the server process (in-memory cache, etc.) resets every session. For persistent state, write to disk or a database.
