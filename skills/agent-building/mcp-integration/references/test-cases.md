# Test Cases: mcp-integration

## Trigger Tests — Should Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| T1 | "How do I set up MCP in Claude Code?" | TRIGGER | Core use case |
| T2 | "Add a GitHub MCP to my project" | TRIGGER | Specific MCP setup |
| T3 | "My `.mcp.json` isn't working — MCP not connecting" | TRIGGER | Debug use case |
| T4 | "I want to connect Claude to my Postgres database" | TRIGGER | DB access use case |
| T5 | "How do I build a custom MCP server for my project?" | TRIGGER | Custom MCP use case |
| T6 | "What's the difference between stdio and HTTP for MCPs?" | TRIGGER | Transport decision |
| T7 | "How do I add filesystem access to my Claude Code agent?" | TRIGGER | Filesystem MCP |
| T8 | "MCP authentication — how do I keep my API keys safe?" | TRIGGER | Auth use case |
| T9 | "extend Claude Code with tools" | TRIGGER | Phrase from description |
| T10 | "Configure mcp.json for my project" | TRIGGER | Config use case |

## No-Trigger Tests — Should NOT Fire

| # | Prompt | Expected | Rationale |
|---|---|---|---|
| N1 | "Set up MCP for Claude Desktop" | NO TRIGGER | Wrong system — Claude Desktop |
| N2 | "How do I publish my MCP server to the MCP marketplace?" | NO TRIGGER | Out of scope — publishing |
| N3 | "Deploy my MCP server to production on AWS" | NO TRIGGER | Out of scope — deployment |
| N4 | "What is Model Context Protocol?" | NO TRIGGER | Conceptual question, no action |
| N5 | "Fix my git merge conflict" | NO TRIGGER | Different domain |

## Output Tests — Assertions Per Scenario

### T1: Basic setup question
- [ ] Explains `.mcp.json` lives in project root
- [ ] Shows actual JSON config example
- [ ] Mentions restart requirement after config change
- [ ] Points to `/mcp` for verification
- [ ] Does NOT explain Claude Desktop config

### T3: Debug scenario
- [ ] Directs user to `/mcp` command first
- [ ] Lists at least 3 failure modes
- [ ] Provides actionable fix for each failure mode
- [ ] Includes how to run server manually for error inspection

### T5: Custom MCP building
- [ ] Shows TypeScript/SDK example
- [ ] Includes `bun add @modelcontextprotocol/sdk` install command
- [ ] Shows how to add to `.mcp.json`
- [ ] Shows verify with `/mcp` step

### T8: Auth/secrets
- [ ] Shows `${ENV_VAR}` reference syntax
- [ ] Warns against hardcoding
- [ ] Shows where to export env vars (shell profile or .env)
- [ ] Mentions gitignore for .env files

## Scoring

Pass rate target: 80%+ on trigger tests, 80%+ on output assertions.

Trigger test score: __/10
Output test score: __/__ assertions passed
