# Auth Without Leaking Secrets

## The Rule

Never hardcode credentials in `.mcp.json`. The file gets committed to git. Committed secrets get leaked.

**Wrong:**
```json
{
  "env": {
    "GITHUB_TOKEN": "ghp_abc123realtoken"
  }
}
```

**Right:**
```json
{
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

## How `${ENV_VAR}` References Work

Claude Code resolves `${VAR_NAME}` from the current shell environment before passing the value to the MCP server process. The literal string `${GITHUB_TOKEN}` never reaches the server — only the resolved value.

## Where to Set Environment Variables

### Option 1: Shell Profile (Recommended for Personal Tokens)

```bash
# ~/.zshrc or ~/.bashrc
export GITHUB_TOKEN=ghp_your_token_here
export BRAVE_API_KEY=BSA_your_key_here
export DATABASE_URL=postgresql://user:pass@localhost/db
```

Restart your terminal or run `source ~/.zshrc` to reload. Claude Code inherits these when launched from that shell.

### Option 2: `.env` File (Recommended for Project-Specific Values)

Create a `.env` file in your project root:
```bash
DATABASE_URL=postgresql://user:pass@localhost/mydb
MY_INTERNAL_API_KEY=sk-internal-abc123
```

**Critical:** Add `.env` to `.gitignore` immediately.
```bash
echo ".env" >> .gitignore
```

Then load it in your shell before launching Claude Code:
```bash
source .env  # or: set -a && source .env && set +a
```

Or use `dotenv` CLI: `dotenv -- claude` to auto-load when starting Claude Code.

### Option 3: OS Keychain / Secret Manager

For team environments where environment variables aren't reliable:
- **macOS**: Keychain Access + a shell wrapper to export from keychain
- **1Password CLI**: `op run --env-file=.env.1password -- claude`
- **Doppler**: `doppler run -- claude`

## Auth Patterns by MCP Type

| MCP | Auth Type | Where to Set |
|---|---|---|
| GitHub | Personal access token | Shell profile (`GITHUB_TOKEN`) |
| Brave Search | API key | Shell profile (`BRAVE_API_KEY`) |
| Postgres | Connection string | `.env` file (`DATABASE_URL`) |
| Filesystem | None (path-based) | N/A |
| Puppeteer | None | N/A |
| Custom internal API | API key or JWT | `.env` file |
| OAuth service | Bearer token | Managed externally, inject via env |

## Checking for Leaked Secrets

Before committing `.mcp.json`:
```bash
# Check for anything that looks like a token/key value (not a reference)
grep -E '"[A-Za-z0-9_\-]{20,}"' .mcp.json
```

If you see long alphanumeric strings that aren't `${VAR_NAME}` references — stop. Rotate that credential immediately, then fix the config.

## .gitignore Checklist

Add these to `.gitignore` in every project with MCP auth:
```
.env
.env.local
.env.*.local
*.token
```

The `.mcp.json` file itself should be committed (it contains only `${VAR}` references). The environment files should never be committed.
