# Plugin Architecture Reference

## plugin.json Manifest

Located at `.claude-plugin/plugin.json`. Minimal required field is `name`.

```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Brief explanation of plugin purpose",
  "author": {
    "name": "Author Name"
  }
}
```

**Name rules:** kebab-case, lowercase with hyphens, no spaces or special characters.
**Version:** semver (MAJOR.MINOR.PATCH). Start at `0.1.0`.

Optional fields: `homepage`, `repository`, `license`, `keywords`.

Custom component paths (supplements auto-discovery):

```json
{
  "commands": "./custom-commands",
  "agents": ["./agents", "./specialized-agents"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

## Component Schemas

### Skills

**Location**: `skills/skill-name/SKILL.md`

Frontmatter:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | String | Lowercase, hyphens; matches directory name |
| `description` | Yes | String | Third-person with trigger phrases in quotes |
| `metadata` | No | Map | Arbitrary key-value pairs (version, author) |

Example:

```yaml
---
name: call-prep
description: >
  Prepare for a sales call with account context, attendee research, and
  suggested agenda. Use when the user asks to "prep me for my call with
  [company]", "call prep [company]", or "get me ready for [meeting]".
---
```

Directory structure:

```
skill-name/
├── SKILL.md              # Core knowledge (required)
├── references/           # Detailed docs loaded on demand
│   ├── patterns.md
│   └── advanced.md
├── examples/             # Working examples
│   └── sample-config.json
└── scripts/              # Utility scripts
    └── validate.sh
```

### MCP Servers

**Location**: `.mcp.json` at plugin root

**HTTP (most common):**
```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp"
    }
  }
}
```

**SSE (server-sent events):**
```json
{
  "mcpServers": {
    "linear": {
      "type": "sse",
      "url": "https://mcp.linear.app/sse"
    }
  }
}
```

**stdio (local process):**
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

Environment variable expansion: `${CLAUDE_PLUGIN_ROOT}` for plugin directory, `${ANY_ENV_VAR}` for user env vars.

### Agents (Uncommon)

**Location**: `agents/agent-name.md`

Frontmatter:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | String | 3-50 chars, kebab-case |
| `description` | Yes | String | Triggering conditions with `<example>` blocks |
| `model` | Yes | String | `inherit`, `sonnet`, `opus`, `haiku` |
| `color` | Yes | String | `blue`, `cyan`, `green`, `yellow`, `magenta`, `red` |
| `tools` | No | Array | Restrict to specific tools |

### Hooks (Rare)

**Location**: `hooks/hooks.json`

Events: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreCompact`, `Notification`.

Types:
- **Prompt-based** (complex logic): `{ "type": "prompt", "prompt": "...", "timeout": 30 }`
- **Command-based** (deterministic): `{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/check.sh", "timeout": 60 }`

Command hook output: `{ "decision": "approve|block|ask_user", "reason": "..." }`

### CONNECTORS.md (Distributable Plugins Only)

Use `~~category` placeholders for tool-agnostic references:

```markdown
# Connectors

## How tool references work

Plugin files use `~~category` as a placeholder for whatever tool the user
connects in that category. Plugins are tool-agnostic.

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| CRM | `~~CRM` | HubSpot | Salesforce, Pipedrive |
| Chat | `~~chat` | Slack | Microsoft Teams |
```

In skill files, reference tools generically: "Check ~~project tracker for open tickets."

## README.md Template

Every plugin includes:

1. **Overview** - what the plugin does
2. **Components** - list of skills, agents, hooks, MCP servers
3. **Setup** - required environment variables or configuration
4. **Usage** - how to trigger each skill
5. **Customization** - if CONNECTORS.md exists, mention it
