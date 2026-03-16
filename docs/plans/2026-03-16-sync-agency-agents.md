# Sync Agency-Agents Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Paperclip skill that syncs agent definitions from the `agency-agents` repository into a Paperclip company, creating new agents or updating existing ones' prompts.

**Architecture:** A SKILL.md file in `skills/sync-agency-agents/` that instructs the LLM how to scan `../agency-agents/`, parse YAML frontmatter, map fields to Paperclip agent schema, and call the hire/update API. Also adds 4 new agent roles to the shared constants package.

**Tech Stack:** Markdown skill, Paperclip REST API, YAML frontmatter parsing, TypeScript constants

---

### Task 1: Add new agent roles to shared constants

**Files:**
- Modify: `packages/shared/src/constants.ts:37-64`

**Step 1: Add roles to AGENT_ROLES array**

In `packages/shared/src/constants.ts`, add `"sales"`, `"support"`, `"security"`, `"writer"` to the `AGENT_ROLES` array (before the closing `] as const`):

```typescript
export const AGENT_ROLES = [
  "ceo",
  "cto",
  "cmo",
  "cfo",
  "engineer",
  "designer",
  "pm",
  "qa",
  "devops",
  "researcher",
  "general",
  "sales",
  "support",
  "security",
  "writer",
] as const;
```

**Step 2: Add labels to AGENT_ROLE_LABELS**

Add the corresponding labels:

```typescript
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  ceo: "CEO",
  cto: "CTO",
  cmo: "CMO",
  cfo: "CFO",
  engineer: "Engineer",
  designer: "Designer",
  pm: "PM",
  qa: "QA",
  devops: "DevOps",
  researcher: "Researcher",
  general: "General",
  sales: "Sales",
  support: "Support",
  security: "Security",
  writer: "Writer",
};
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/patrickfalvey/code/paperclip && pnpm build --filter @paperclipai/shared`
Expected: Build succeeds with no type errors. The UI files already cast `AGENT_ROLE_LABELS as Record<string, string>` so no UI changes needed — new roles auto-appear in dropdowns and labels.

**Step 4: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add sales, support, security, writer agent roles"
```

---

### Task 2: Create the sync-agency-agents skill directory

**Files:**
- Create: `skills/sync-agency-agents/SKILL.md`

**Step 1: Create the skill file**

Create `skills/sync-agency-agents/SKILL.md` with the content below. This is the complete skill — it contains the full workflow, mapping tables, prompt template, and API calls.

```markdown
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

Build a lookup map: `metadata.agencyAgentSource` → agent object. This is how we match existing agents to agency-agent files.

## Step 4 — Scan and parse agent files

For each requested category directory, find all `.md` files (excluding README):

```bash
find ../agency-agents/<category>/ -name "*.md" ! -name "README.md" -type f
```

For each file, parse:
1. **YAML frontmatter** (between `---` delimiters): `name`, `description`, `color`, `emoji`, `vibe`, `services`
2. **Markdown body** (everything after the second `---`): the full agent persona prompt

## Step 5 — Map fields

### Category → Role mapping

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

### Category → Icon mapping

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

From the frontmatter `name` field. If it conflicts with an existing agent name (that isn't an agency-agent import), append the category prefix. Example: if "Code Reviewer" exists, use "Engineering Code Reviewer".

### Prompt template composition

Prepend the Paperclip heartbeat preamble to the agency-agent markdown body:

```
You are a Paperclip agent. You MUST follow the Paperclip heartbeat protocol every time you wake up — use the `paperclip` skill for the full procedure. Check assignments, checkout before working, update status, and comment before exiting. Your domain expertise is described below.

---

<full agency-agent markdown body here>
```

## Step 6 — Dry run

Before making any API calls, present a summary table:

```
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

Wait for user confirmation before proceeding.

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

Only update if the prompt content has changed (compare current `adapterConfig.promptTemplate` with the new composed prompt).

```bash
curl -sS -X PATCH "$PAPERCLIP_API_URL/api/agents/<agent-id>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "adapterConfig": {
      ...existing adapterConfig,
      "promptTemplate": "<new preamble + body>"
    },
    "capabilities": "<updated description>",
    "metadata": {
      ...existing metadata,
      "agencyAgentSource": "<category>/<filename>.md",
      "syncedAt": "<ISO timestamp>"
    }
  }'
```

Preserve all existing `adapterConfig` fields (like `cwd`, `model`) — only update `promptTemplate`.

## Step 8 — Report results

After sync completes, show:

```
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
- **Partial failure**: Continue processing remaining agents, report failures at end
```

**Step 2: Verify the skill file is well-formed**

Read back the file and verify:
- YAML frontmatter has `name` and `description`
- All referenced API endpoints match Paperclip's actual API
- Mapping tables are complete for all 14 categories (excluding `integrations`)

**Step 3: Commit**

```bash
git add skills/sync-agency-agents/SKILL.md
git commit -m "feat: add sync-agency-agents skill for importing agency-agent personas"
```

---

### Task 3: Verify end-to-end

**Step 1: Build shared package**

Run: `cd /Users/patrickfalvey/code/paperclip && pnpm build --filter @paperclipai/shared`
Expected: Success, no type errors

**Step 2: Verify new roles appear in validator**

Run: `cd /Users/patrickfalvey/code/paperclip && node -e "const {AGENT_ROLES} = require('./packages/shared/dist/index.js'); console.log(AGENT_ROLES)"`
Expected: Array includes `sales`, `support`, `security`, `writer`

**Step 3: Verify skill is discoverable**

Check that the skill directory follows the same structure as existing skills:
```bash
ls -la skills/sync-agency-agents/SKILL.md
ls -la skills/paperclip/SKILL.md  # comparison
```

**Step 4: Commit (if any fixes needed)**

Only if verification revealed issues.

---

### Task 4: Final commit with both changes

If Tasks 1-3 were committed separately, this is already done. Otherwise:

```bash
git add packages/shared/src/constants.ts skills/sync-agency-agents/SKILL.md
git commit -m "feat: add sync-agency-agents skill and new agent roles

- Add sales, support, security, writer roles to AGENT_ROLES
- Create sync-agency-agents skill for importing agency-agent personas
- Skill supports category filtering, dry-run preview, create/update sync
- Maps agency-agent categories to Paperclip roles and icons
- Prepends Paperclip heartbeat preamble to agent prompt templates"
```
