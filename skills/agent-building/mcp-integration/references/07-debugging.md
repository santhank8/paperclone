# Debugging MCP Failures with `/mcp`

## The `/mcp` Command

Run `/mcp` inside a Claude Code session to open the MCP diagnostic panel. It shows every configured server and its current state.

## Status Meanings

| Status | Meaning | Action |
|---|---|---|
| `connected` | Server is running and responding | Nothing — you're good |
| `connecting` | Startup in progress | Wait 5 seconds, then re-check |
| `failed` | Server started but errored | Read the error output below the status |
| `disabled` | Manually disabled | Re-enable in settings |
| `not configured` | Server name appears in config but has no entries | Check `.mcp.json` for typos |

## The 5 Most Common Failures

### 1. Wrong command path

**Error:** `spawn npx ENOENT` or `command not found`

**Cause:** `npx` isn't in PATH, or the executable doesn't exist at the given path.

**Fix:**
```bash
# Verify npx is available
which npx  # Should return a path

# For node scripts, use the absolute path
"command": "/usr/local/bin/node"  # instead of "node"

# Or use the full path to npx
"command": "/usr/local/bin/npx"
```

### 2. Missing environment variable

**Error:** `GITHUB_TOKEN is not set` or similar auth errors

**Cause:** The `${ENV_VAR}` reference resolved to an empty string because the variable isn't in the shell environment when Claude Code launched.

**Fix:**
```bash
# Check if the variable is set
echo $GITHUB_TOKEN

# If empty, set it and restart Claude Code
export GITHUB_TOKEN=ghp_your_token_here
# Then close Claude Code and reopen from the same terminal session
```

### 3. Wrong transport type

**Error:** Server shows `failed` immediately without a useful error message

**Cause:** Using stdio config for an HTTP server, or vice versa. Claude Code sends the wrong protocol framing.

**Fix:** Check whether the server expects stdio or HTTP. If HTTP, use `url` instead of `command` + `args`. If stdio, the server must read from stdin.

### 4. Permission denied

**Error:** `EACCES permission denied`

**Cause:** The script or binary isn't executable.

**Fix:**
```bash
chmod +x ./my-mcp-server/index.js
# Or use `node` / `bun` as the command and pass the script as an arg
```

### 5. Process crashes on startup

**Error:** MCP connects briefly then drops to `failed`

**Cause:** Server exits immediately due to a startup error (missing dep, syntax error, config validation failure).

**Fix:**
```bash
# Run the server process manually to see the actual error
npx -y @modelcontextprotocol/server-github
# Or for custom servers:
bun run ./my-mcp-server/index.ts
# Read the stderr output — that's your error
```

## Reading `/mcp` Output

The panel shows:
```
github       connected    ✓ 12 tools available
postgres     failed       ✗ Error: ECONNREFUSED 127.0.0.1:5432
filesystem   connected    ✓ 6 tools available
```

For `failed` servers, `/mcp` shows the error message inline. That message is almost always enough to identify which of the 5 failures above you're dealing with.

## Force-Restarting MCPs

If you changed `.mcp.json` or fixed an env var, you need to restart Claude Code for changes to take effect. There's no hot-reload — MCP servers are spawned at session start.

Quick restart workflow:
1. Fix the config or env var
2. Close Claude Code completely
3. Reopen from a terminal where the env vars are exported
4. Run `/mcp` to verify
