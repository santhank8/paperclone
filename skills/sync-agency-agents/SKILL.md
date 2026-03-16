---
name: sync-agency-agents
description: >
  Sync agent definitions from the agency-agents repository into a Paperclip
  company. Reads markdown agent files, parses YAML frontmatter, and creates
  or updates Paperclip agents via the API. Use when asked to "sync agency
  agents", "import agency agents", or "update agent prompts from agency-agents".
---

# Sync Agency-Agents Skill

Import agent persona definitions from the [agency-agents](https://github.com/steveyegge/agency-agents) repository into a Paperclip company. Creates new agents or updates existing agents' prompt templates.

## Prerequisites

- `PAPERCLIP_API_URL` and `PAPERCLIP_API_KEY` env vars (or board session)
- The `agency-agents` repo must be accessible on the local filesystem
- You need board access or an agent with `can_create_agents` permission

## Step 1 — Locate the agency-agents repo

Look for the repo in these locations (in order):
1. `../agency-agents/` (sibling directory to the Paperclip project)
2. `~/code/agency-agents/`
3. Ask the user for the path

Verify by checking for `README.md` and at least one category directory (e.g., `engineering/`).

## Step 2 — Parse arguments

The user invokes this skill with category names:

```
/sync-agency-agents engineering sales design
```

- If categories are provided, only sync those directories
- If no categories are provided, list all available categories with agent counts and ask which to sync
- Support `--all` to sync everything (with confirmation)

Available categories (directory names in agency-agents repo):
`academic`, `design`, `engineering`, `game-development`, `integrations`, `marketing`, `paid-media`, `product`, `project-management`, `sales`, `spatial-computing`, `specialized`, `strategy`, `support`, `testing`

## Step 3 — Get company context

```bash
curl -sS "$PAPERCLIP_API_URL/api/agents/me" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

If running as a board user (not an agent), get the company ID from context or ask.

Then fetch the existing agent roster:

```bash
curl -sS "$PAPERCLIP_API_URL/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

Build a lookup map: `metadata.agencyAgentSource` -> agent object. This is how we match existing agents to agency-agent files for idempotent sync.

## Step 4 — Scan and parse agent files

For each requested category directory, find all `.md` files (excluding README):

```bash
find ../agency-agents/<category>/ -name "*.md" ! -name "README.md" -type f
```

For each file, parse:
1. **YAML frontmatter** (between `---` delimiters): `name`, `description`, `color`, `emoji`, `vibe`, `services`
2. **Markdown body** (everything after the second `---`): the full agent persona prompt

## Step 5 — Map fields

### Category to Role mapping

| Agency category | Paperclip role |
|---|---|
| `engineering` | `engineer` |
| `design` | `designer` |
| `marketing` | `cmo` |
| `sales` | `sales` |
| `testing` | `qa` |
| `product` | `pm` |
| `project-management` | `pm` |
| `support` | `support` |
| `game-development` | `engineer` |
| `spatial-computing` | `engineer` |
| `academic` | `researcher` |
| `strategy` | `general` |
| `specialized` | `general` |
| `paid-media` | `sales` |

### Category to Icon mapping

| Agency category | Paperclip icon |
|---|---|
| `engineering` | `code` |
| `design` | `sparkles` |
| `marketing` | `globe` |
| `sales` | `target` |
| `testing` | `bug` |
| `product` | `lightbulb` |
| `project-management` | `puzzle` |
| `support` | `message-square` |
| `game-development` | `swords` |
| `spatial-computing` | `hexagon` |
| `academic` | `microscope` |
| `strategy` | `telescope` |
| `specialized` | `wand` |
| `paid-media` | `target` |

### Name derivation

Use the frontmatter `name` field. If it conflicts with an existing agent name (that is NOT an agency-agent import), append the category prefix. Example: if "Code Reviewer" already exists as a non-imported agent, use "Engineering Code Reviewer".

### Prompt template composition

Prepend the Paperclip heartbeat preamble to the agency-agent markdown body:

```
You are a Paperclip agent. You MUST follow the Paperclip heartbeat protocol every time you wake up — use the `paperclip` skill for the full procedure. Check assignments, checkout before working, update status, and comment before exiting. Your domain expertise is described below.

---

<full agency-agent markdown body here>
```

## Step 6 — Dry run

Before making any API calls, present a summary table to the user:

```markdown
## Sync Preview

Source: ../agency-agents/
Categories: engineering, sales
Company: <company-name> (<company-id>)

| Agent | Source File | Action | Role |
|-------|-----------|--------|------|
| Frontend Developer | engineering/engineering-frontend-developer.md | CREATE | engineer |
| Backend Architect | engineering/engineering-backend-architect.md | UPDATE (prompt changed) | engineer |
| Discovery Coach | sales/sales-discovery-coach.md | SKIP (unchanged) | sales |

Creates: 15 | Updates: 3 | Skips: 5

Proceed? (yes/no)
```

Wait for user confirmation before proceeding. Do NOT execute without explicit approval.

## Step 7 — Execute sync

### For new agents (CREATE):

```bash
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<frontmatter.name>",
    "role": "<mapped-role>",
    "title": "<frontmatter.description>",
    "icon": "<mapped-icon>",
    "capabilities": "<frontmatter.description>. Vibe: <frontmatter.vibe>",
    "adapterType": "claude_local",
    "adapterConfig": {
      "promptTemplate": "<preamble + body>"
    },
    "runtimeConfig": {
      "heartbeat": {
        "enabled": false
      }
    },
    "metadata": {
      "agencyAgentSource": "<category>/<filename>.md",
      "agencyAgentEmoji": "<frontmatter.emoji>",
      "agencyAgentColor": "<frontmatter.color>",
      "syncedAt": "<ISO timestamp>"
    }
  }'
```

Note: If the company requires board approval for hires, the agent will be created in `pending_approval` status. Report this to the user.

### For existing agents (UPDATE):

Only update if the prompt content has changed. Compare the current `adapterConfig.promptTemplate` with the newly composed prompt.

```bash
curl -sS -X PATCH "$PAPERCLIP_API_URL/api/agents/<agent-id>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "adapterConfig": {
      "<...existing adapterConfig fields preserved...>",
      "promptTemplate": "<new preamble + body>"
    },
    "capabilities": "<updated description>",
    "metadata": {
      "<...existing metadata fields preserved...>",
      "agencyAgentSource": "<category>/<filename>.md",
      "syncedAt": "<ISO timestamp>"
    }
  }'
```

IMPORTANT: Preserve all existing `adapterConfig` fields (like `cwd`, `model`, etc.) — only update `promptTemplate`. Merge, do not replace.

## Step 8 — Report results

After sync completes, show:

```markdown
## Sync Complete

| Agent | Action | Status |
|-------|--------|--------|
| Frontend Developer | Created | pending_approval |
| Backend Architect | Updated | idle |
| Discovery Coach | Skipped | (unchanged) |

Total: 23 processed, 15 created, 3 updated, 5 skipped, 0 errors
```

If any errors occurred, list them with details and suggest remediation.

## Edge Cases

- **Agent name collision**: If a non-agency-agent already has the same name, prefix with the category name
- **Missing frontmatter**: Skip the file and warn
- **Large prompt**: If `promptTemplate` exceeds 100KB, warn but proceed (adapter may truncate)
- **Rate limiting**: If API returns 429, pause and retry after the indicated delay
- **Partial failure**: Continue processing remaining agents, report all failures at end
- **Subdirectories**: Some categories like `game-development/` have engine-specific subdirectories (unity/, unreal-engine/, etc.) — recurse into them
