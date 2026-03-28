---
name: cowork-plugin-builder
description: >
  Build custom Claude Cowork plugins for enterprise clients. Use when asked to
  "build a plugin", "create a Cowork plugin", "make a plugin for [role]",
  "plugin for [company]", "build a [sales/legal/data/etc] plugin", or when
  a Paperclip issue references plugin creation. Handles the full lifecycle:
  client discovery, component planning, skill authoring, MCP connector wiring,
  packaging as .plugin files. NOT for building Claude Code skills (use
  highimpact-skill-builder) or modifying Paperclip core.
---

# Cowork Plugin Builder

Build custom Claude Cowork plugins for enterprise clients. Each plugin bundles skills, connectors, and optional agents/hooks for a specific job function or workflow.

Plugins are file-based: markdown and JSON, no code, no infrastructure, no build steps.

## Phase Detection

| Signal | Phase |
|--------|-------|
| New client request, no existing plugin directory | Phase 1: Discovery |
| Discovery done, component list confirmed | Phase 2: Build |
| Plugin built, needs validation | Phase 3: Package & Deliver |
| Existing plugin, client wants changes | Phase 4: Customize |

## Plugin Architecture

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json           # Required manifest
├── skills/                   # One subdirectory per skill
│   └── skill-name/
│       ├── SKILL.md          # Core instructions (imperative, <3000 words)
│       └── references/       # Detailed docs loaded on demand
├── agents/                   # Subagent definitions (uncommon)
│   └── agent-name.md
├── hooks/
│   └── hooks.json            # Event-driven automation (rare)
├── .mcp.json                 # Tool connections
├── CONNECTORS.md             # Category placeholders (distributable plugins only)
└── README.md                 # Plugin documentation
```

Read `references/architecture.md` for component schemas, manifest format, and writing rules.

## Phase 1: Discovery

Understand the client's needs before building anything.

1. **What role/function does this plugin serve?** Map to a category: sales, engineering, legal, finance, data, marketing, customer support, product management, operations, HR, design, or custom.

2. **What external tools does the client use?** CRM, chat, project tracker, data warehouse, email, etc. Check `references/mcp-directory.md` for known endpoints.

3. **What workflows should the plugin automate?** Each distinct workflow becomes one skill. Aim for 3-8 skills per plugin. More than 10 means the plugin scope is too broad.

4. **Is this org-specific or distributable?** Org-specific: hardcode tool names. Distributable: use `~~category` placeholders.

5. **What does success look like?** Identify 2-3 concrete scenarios where the plugin saves time.

Output: a component plan table confirming skill count, MCP connectors, and any agents/hooks.

## Phase 2: Build

Output to `plugins/[client-name]/[plugin-name]/`.

**Build order:**
1. `.claude-plugin/plugin.json` manifest
2. Each skill's `SKILL.md` with `references/` for depth
3. `.mcp.json` with all connectors
4. `CONNECTORS.md` (distributable plugins only)
5. `README.md`

Read `references/skill-writing-guide.md` for skill authoring rules.
Read `references/mcp-directory.md` for confirmed MCP endpoints.
Read `references/example-plugins.md` for structural templates at 3 complexity levels.

### Skill Authoring Rules (Summary)

- Frontmatter: `name` (kebab-case), `description` (third-person with trigger phrases in quotes)
- Body: imperative instructions FOR Claude, not docs for users
- Under 3,000 words. Move detail to `references/`
- Include output format templates for structured output skills
- Include execution flow (step-by-step) for multi-step workflows
- Progressive disclosure: metadata (always) -> SKILL.md body (when triggered) -> references (on demand)

### MCP Connector Rules

- Use `type: "http"` for remote servers (most common)
- Use `type: "sse"` for SSE transport (Linear, etc.)
- Use `command`/`args` for local stdio servers
- Always use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin paths
- Document required env vars in README

## Phase 3: Package & Deliver

1. Validate structure:
   - `.claude-plugin/plugin.json` exists with valid `name` (kebab-case)
   - Every skill directory has a `SKILL.md`
   - `.mcp.json` is valid JSON if present
   - No hardcoded absolute paths

2. Package:
```bash
cd /path/to/plugin && zip -r /tmp/plugin-name.plugin . -x "*.DS_Store" "*.git*"
```

3. Post summary as Paperclip issue comment: skill count, connectors, known limitations.

## Phase 4: Customize

For modifying existing plugins:

1. Locate the plugin directory
2. Check for `~~` placeholders: `grep -rn '~~' /path/to/plugin --include='*.md' --include='*.json'`
3. If placeholders exist: replace with client's actual tool names
4. If no placeholders: make targeted edits to the specific files the client wants changed
5. Re-package and deliver

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I can build a generic plugin that works for everyone" | Generic plugins help no one well. The client's specific tools, terminology, and workflows are the whole point. |
| "This skill is simple, I don't need references/" | If it's over 100 lines, split it. Claude skips the bottom half of long skills. |
| "I'll just guess the MCP endpoint" | Wrong endpoints silently fail. Check the directory or search for the server first. |
| "The client doesn't need all these skills, 2 is enough" | 2 skills is a CLAUDE.md, not a plugin. Aim for 3-8 skills that cover the role's key workflows. |
| "I'll add hooks for everything" | Hooks are rare. Most plugins need only skills and connectors. Add hooks only when behavior must trigger automatically on events. |
| "I don't need to test the trigger descriptions" | Descriptions are the routing signal. Bad descriptions mean the skill never fires. Include realistic trigger phrases. |
