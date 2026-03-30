---
title: Skills
summary: Managing your company's skill library and assigning skills to agents
---

Skills are reusable instruction packages that give agents additional capabilities. Each skill is a directory containing a `SKILL.md` file — a markdown document with a name, description, and detailed instructions that an agent can load on demand during execution.

Your company has a **skill library** managed from the Skills page in the sidebar. This is the central catalog — you add skills here, and then enable them on individual agents from each agent's Skills tab.

## The Skills page

Open the **Skills** page from the Company section in the sidebar. The page has two columns: a skill list on the left and a detail pane on the right.

### Skill list

The left sidebar shows all skills in your company library with a count ("4 available"). Each skill displays its source icon and name. Click a skill to view its detail. Click the chevron to expand the skill's file tree — you'll see `SKILL.md` plus any supporting files like a `references/` directory.

Use the **filter** field at the top to search skills by name or key.

### Adding skills

There are two ways to add skills to your library:

**Import from a source** — paste a path, GitHub URL, or skills.sh command into the input field at the top of the skill list and click **Add**. This pulls the skill into your library from the source. Supported sources:

- **Local path** — an absolute path to a skill directory on your filesystem.
- **GitHub URL** — a link to a GitHub repository containing a `SKILL.md`.
- **skills.sh** — a command or URL from the skills.sh marketplace.

**Create a new skill** — click the **+** button in the skill list header. Fill in:

- **Skill name** — the display name.
- **Shortname** (optional) — a slug used as the skill's key.
- **Short description** — what the skill does.

After creation, the skill appears in your library as an editable entry. Open it to write the `SKILL.md` content.

### Scanning for skills

Click the **refresh** button (circular arrow) in the skill list header to scan your project workspaces for skill directories. Paperclip looks for `SKILL.md` files across known paths and imports any new skills it finds. This is useful when skills are added to your codebase outside of Paperclip.

## Skill detail

Click a skill in the list to see its detail pane. The header shows:

- **Name** and **description**
- **Source** — where the skill came from (Paperclip bundled, GitHub, local path, skills.sh, etc.)
- **Key** — the unique identifier (e.g., `paperclipai/paperclip/paperclip`)
- **Mode** — "Editable" or "Read only". Bundled Paperclip skills are read-only; skills you create or import from local paths are editable.
- **Used by** — which agents have this skill enabled. Each agent name links to that agent's Skills tab.

### Viewing skill content

The file tree in the left sidebar shows the skill's files. Click any file to display it in the detail pane. For markdown files, you can toggle between:

- **View** — rendered markdown preview
- **Code** — raw markdown source

### Editing skills

For editable skills, click the **pencil** icon in the header to enter edit mode. The file content becomes editable — make your changes and click **Save**. Markdown files use a rich editor with image upload support.

You can edit any file in the skill's directory, not just `SKILL.md`. Reference files in the `references/` directory are often used for API documentation, examples, or detailed procedures that support the main skill instructions.

### Updating skills from GitHub

For skills imported from GitHub, the detail pane shows version information:

- **Current pin** — the git ref the skill is pinned to (shown as a short hash).
- **Check for updates** — click to query the source repository for newer versions.
- **Install update** — appears when an update is available. Click to pull the latest version and update the pin.

This lets you keep skills in sync with upstream repositories while controlling when updates are applied.

## Built-in skills

Paperclip ships with four built-in skills:

- **paperclip** — the core skill that gives agents access to the Paperclip API. Covers authentication (environment variables like `PAPERCLIP_API_KEY`), the heartbeat procedure, issue management, approvals, and all API endpoints. This is required for all local agents.
- **paperclip-create-agent** — instructions for creating new agents programmatically.
- **paperclip-create-plugin** — instructions for creating Paperclip plugins.
- **para-memory-files** — a memory system using the PARA method (Projects, Areas, Resources, Archive). Used by the CEO for maintaining context across heartbeats via daily notes and weekly synthesis.

Built-in skills are **read-only** — you can view their content but not modify them. A banner at the top of the detail pane notes "Bundled Paperclip skills are read-only."

## How skills relate to agents

The company Skills page is your **library** — it's where skills live. The agent's **Skills tab** is where you choose which skills from the library are enabled for that specific agent.

The flow works like this:

1. **Add a skill** to your company library (import, create, or scan).
2. **Open an agent's detail page** and go to the Skills tab.
3. **Enable the skill** by checking its checkbox in the Optional Skills section.
4. The skill is now available to that agent during heartbeat execution.

Skills on an agent are organized into three categories:

- **Required** — always active, enforced by the adapter (e.g., the `paperclip` skill). You can't disable these.
- **Optional** — from your company library. Toggle on or off per agent. Changes auto-save.
- **Unmanaged** — skills installed directly on the filesystem (e.g., in `~/.claude/skills/`), not through Paperclip. Shown as read-only so you know they're present.

When an agent runs, its enabled skills are mounted into the agent's environment. The agent discovers skills through their descriptions (in the SKILL.md frontmatter) and loads the full content when the situation matches. Skills don't replace the agent's instruction files — they extend them with on-demand capabilities.

## Skill trust levels

Each skill has a trust level that controls what it can contain:

- **Markdown only** — just the SKILL.md instructions. Safest option.
- **Assets** — can include reference files like documentation and examples.
- **Scripts & executables** — can include runnable code. Use with caution and only for skills you trust.

## Tips

- Start with the built-in skills — they cover the core Paperclip API and memory system. You'll rarely need to modify these.
- When creating custom skills, write a clear description in the SKILL.md frontmatter. The description is what the agent uses to decide when to load the skill, so "Use when handling customer support tickets" is better than "Customer support."
- Use the `references/` directory for detailed API documentation, code examples, or domain-specific knowledge that supports the main skill instructions.
- Pin GitHub skills to specific versions in production. Use "Check for updates" to review changes before installing.
- If a skill isn't being used by an agent, check the "Used by" field on the Skills page — it may not be enabled on that agent's Skills tab.

## Related

- [Managing Agents](/guides/board-operator/managing-agents) — the agent Skills tab and how agents use skills at runtime
- [Writing a Skill](/guides/agent-developer/writing-a-skill) — creating custom skills (agent developer guide)
