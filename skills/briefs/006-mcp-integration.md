# Skill Brief: MCP Integration for Claude Code

## Demand Signal

- **ClawHub McPorter**: 37,500 downloads — a CLI wrapper that lets people call MCP servers via terminal. People want MCP access so badly they're installing a wrapper just to get it.
- **ClawHub API Gateway**: 44,600 downloads — 100+ managed OAuth integrations to external services. Same hunger: connect Claude to the outside world.
- **Combined proxy-for-MCP demand**: ~82K downloads for "give my agent external tool access"
- **GitHub MCP label**: 30+ open issues in the Claude Code repo as of March 2026 — more open issues than any other feature area. Top complaints: `.mcp.json` scope confusion, OAuth auth loops, permission wildcard failures, stdio vs HTTP setup.
- **GitHub issue #31978**: Feature request "init should ask which MCPs to add" — 80+ upvotes in two weeks. Developers know they need MCPs but don't know how to set them up.
- **YouTube**: NetworkChuck "you need to learn MCP RIGHT NOW" has 1.3M views. MCP vs API overview: 933K views. ALL focus on Claude Desktop or generic LLM clients. Zero top-results content teaches Claude Code's native `.mcp.json` system, project vs user scope, or building custom MCPs for an agent.
- **Content gap confirmed**: "Claude Code MCP tutorial" returns no dedicated results — the NetworkChuck video covers Claude Desktop in passing, then moves on.

## Target Audience

Developers who've built basic Claude Code workflows and are hitting the ceiling:

- They see agents failing because Claude can't access their database, GitHub API, or file system programmatically
- They've heard "just use MCPs" but don't know what that means in Claude Code specifically (Claude Desktop has a config file, but what does Claude Code use?)
- They've tried installing McPorter or API Gateway but feel like they're adding abstraction on top of something they should understand directly
- They're comfortable with JSON config files and have touched Node.js or TypeScript before

They don't need "what is MCP?" explained from scratch. They need the Claude Code-specific workflow: where does the config live, how does scope work, how do they pick the right MCPs, and what do they do when it doesn't connect.

## Core Thesis

Claude Code has native MCP support built in. You don't need a CLI wrapper or managed gateway — a single `.mcp.json` file gives your agent access to databases, APIs, file systems, and custom tools. The skill teaches the native way: config that lives with your code, scope that matches your trust model, and a pattern for building simple custom servers when nothing off-the-shelf fits.

## Skill Scope

### In Scope
- What `.mcp.json` is and where it lives (project vs user scope — when to use each)
- stdio vs HTTP transport — which to use and why
- Installing and configuring the top 5 MCPs every developer needs: filesystem, GitHub, Postgres/SQLite, web search, and Puppeteer/browser
- Auth patterns: env vars, API keys, OAuth — correct pattern for each
- Using `/mcp` to inspect connection state and debug failures
- Building a minimal custom MCP server (< 50 lines TypeScript) for project-specific tools
- Security model: what MCPs can and can't access, permission scoping in Claude Code

### Out of Scope
- Building production MCP servers with full validation, error handling, and versioning
- MCP server hosting and deployment beyond local stdio
- Claude Desktop MCP configuration (different system)
- MCP OAuth server-side implementation
- MCP plugin/marketplace publishing

## Sections

1. **Why MCPs Are Different from Regular Tools** — Tools are built into Claude Code (Bash, Read, Write). MCPs extend Claude's reach to external systems it couldn't otherwise touch. The distinction matters because MCPs add latency, can fail, and carry auth state.

2. **The `.mcp.json` Config File** — Where it lives (project root vs `~/.claude/`), what the schema looks like, and the critical difference between project scope (checked into repo, available to all agents on this codebase) vs user scope (personal tools, not committed).

3. **stdio vs HTTP: Pick the Right Transport** — stdio spawns a local process (simple, no auth, low latency). HTTP connects to a running server (required for remote services, OAuth). Decision table: when to use each, common mistakes mixing them up.

4. **The 5 MCPs That Cover 90% of Use Cases**
   - `@modelcontextprotocol/server-filesystem` — scoped read/write access beyond the project directory
   - `@modelcontextprotocol/server-github` — issues, PRs, repo access via GitHub token
   - `@modelcontextprotocol/server-postgres` — direct SQL queries (read-only or read-write)
   - `@modelcontextprotocol/server-brave-search` — web search with a free tier API key
   - `@modelcontextprotocol/server-puppeteer` — browser automation for scraping and UI testing

   For each: exact `.mcp.json` snippet, where to get the API key (if needed), and the one config mistake everyone makes.

5. **Auth Without Leaking Secrets** — Never hardcode secrets in `.mcp.json` (it gets committed). The right pattern: `${ENV_VAR_NAME}` references that resolve from environment. Where to set them: shell profile, `.env` (gitignored), or project secrets.

6. **Build a Custom MCP in 40 Lines** — When off-the-shelf MCPs don't fit your project. Use case: a custom MCP that reads from your internal API or exposes project-specific tools. TypeScript example using `@modelcontextprotocol/sdk`, one resource, one tool, stdio transport. Build, add to `.mcp.json`, verify with `/mcp`.

7. **Debugging with `/mcp`** — The `/mcp` command is your diagnostic panel. What each status means (connected, failed, disabled), how to read the error output, the five most common failure modes and their fixes (wrong path, missing env var, wrong transport, permission denied, process crashes on startup).

8. **Security Model** — MCPs run with the permissions of the spawning user. Project-scoped MCPs are visible to all agents in that repo — don't add an MCP with broad filesystem access to a shared project config. User-scoped MCPs for personal tools, project-scoped for repo-specific integrations. Permission requests in Claude Code UI for MCP tool calls.

## Success Criteria

After installing this skill, the developer can:

- [ ] Add a GitHub MCP to `.mcp.json` and have it connected and usable in under 5 minutes
- [ ] Correctly choose between project-scoped and user-scoped MCP configuration
- [ ] Configure API key auth using env var references (not hardcoded secrets)
- [ ] Use `/mcp` to diagnose a failed MCP connection and identify the root cause
- [ ] Build a custom stdio MCP server with one tool exposed and add it to their project config
- [ ] List the 5 core MCPs and explain what each provides
- [ ] Explain the difference between stdio and HTTP transport and when to use each

## Keywords

MCP, Model Context Protocol, `.mcp.json`, Claude Code MCP, MCP setup, MCP tutorial, custom MCP server, GitHub MCP, filesystem MCP, MCP authentication, project scope MCP, user scope MCP, MCP debugging, stdio MCP, HTTP MCP, MCP tools, Claude Code tools, extend Claude Code, MCP TypeScript, connect Claude to database, connect Claude to GitHub

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| **McPorter (37.5K downloads)**: CLI wrapper to call MCP servers from terminal — hides the config, adds a layer, doesn't teach you what's happening | Native `.mcp.json` — you configure it directly, understand the transport, no wrapper needed |
| **API Gateway (44.6K downloads)**: Managed OAuth gateway for 100+ services — works but you have no idea what's connected or why it fails | Direct MCP config — you own every server in your config, you know the auth pattern for each |
| **YouTube MCP tutorials (1.3M+ views)**: All focus on Claude Desktop (`claude_desktop_config.json`) — different system, different scope model, doesn't apply to Claude Code workflows | Claude Code-specific: `.mcp.json`, project vs user scope, agent coordination patterns |
| **Generic "what is MCP" content**: Conceptual only, no working config examples | Working `.mcp.json` snippets for every MCP covered, copy-paste ready |

## Estimated Complexity

**Medium** — requires:
- Node.js + bun for running MCP servers and the custom MCP example
- One API key (Brave Search free tier or GitHub token — developer likely already has at least one)
- Basic JSON config familiarity

No unusual dependencies. The custom MCP section uses `@modelcontextprotocol/sdk` which installs in one command. All five core MCPs are official `@modelcontextprotocol` packages.
