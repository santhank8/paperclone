---
name: autonomous-agent
description: Use when building autonomous agents in Claude Code without external frameworks. Triggers on: "build an agent", "autonomous agent", "self-improving agent", "set up hooks", "PreToolUse hook", "PostToolUse hook", "SessionStart hook", "agent memory", "persist knowledge between sessions", "configure subagents", "CLAUDE.md rules", "agent that learns from mistakes", "no framework agent", "make Claude Code autonomous", "enforce rules automatically". Also fires when developers want Claude Code to capture learnings across sessions, delegate to subagents, or load prior context on startup. NOT for: MCP server setup, spec loop orchestration, or multi-agent SendMessage coordination.
---

# Autonomous Agent Inside Claude Code

Six native primitives. No framework required.

## The Six Primitives

| Primitive | Role | Where |
|-----------|------|-------|
| CLAUDE.md | Brain — persistent instructions | `~/.claude/CLAUDE.md` (global), `./CLAUDE.md` (project) |
| Hooks | Reflexes — event-driven automation | `~/.claude/settings.json` → `hooks` |
| Memory files | Long-term knowledge — cross-session persistence | Any path, loaded by SessionStart hook |
| Skills (.md) | Capabilities — reusable workflows | `~/.claude/skills/[name]/SKILL.md` |
| Subagents | Delegation — specialized task runners | Agent `.md` config files |
| MCP servers | Reach — external tool access | `~/.claude/.mcp.json` (separate skill) |

## Entry Points

| Goal | Section |
|------|---------|
| Define agent behavior and rules | [CLAUDE.md: Brain](#claudemd-brain) |
| Enforce rules / capture learnings automatically | [Hooks: Reflexes](#hooks-reflexes) |
| Persist knowledge between sessions | [Memory: Long-Term Knowledge](#memory-long-term-knowledge) |
| Delegate routine work | [Subagents: Delegation](#subagents-delegation) |
| Wrap a workflow into one command | [Skills: Capabilities](#skills-capabilities) |
| Build the complete self-improving loop | [Putting It Together](#putting-it-together) |

---

## CLAUDE.md: Brain

Two scopes: global (`~/.claude/CLAUDE.md`) and project (`./CLAUDE.md`). Project overrides global on conflicts.

**Structure that works:**

```markdown
# Core Behaviors
- Rule 1 (non-negotiable)
- Rule 2

# Tool Selection
[Which tools to use when]

# Stack-Specific Rules
@~/.claude/stacks/[stack].md
```

**In CLAUDE.md:** Behavioral rules, tool preferences, delegation logic, stack-specific patterns (via `@path` includes).

**Not in CLAUDE.md:** Code patterns, architecture, anything derivable from git. CLAUDE.md is for *behavior*, not facts.

---

## Hooks: Reflexes

Register in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "/abs/path/pre-hook.sh" }] }],
    "PostToolUse": [{ "matcher": "Edit", "hooks": [{ "type": "command", "command": "/abs/path/post-hook.sh" }] }],
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "/abs/path/session-start.sh" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "/abs/path/stop-hook.sh" }] }]
  }
}
```

| Hook | When | Use For |
|------|------|---------|
| PreToolUse | Before tool call | Block forbidden actions, enforce standards |
| PostToolUse | After tool call | Capture metrics, log decisions, save learnings |
| SessionStart | On session open | Load memory context, show active tasks |
| Stop | On session end | Auto-save handoff, flush learnings |

**Critical:** Hooks must use absolute paths. Relative paths silently fail.

See `references/hooks.md` for working code examples of each type.

---

## Memory: Long-Term Knowledge

File-based. No database. Load via SessionStart hook.

**Save:** decisions (why X over Y), gotchas (mistakes to avoid), user preferences, milestones.
**Don't save:** code patterns, architecture, anything in git.

```
~/.claude/memory/
├── MEMORY.md          # Index — loaded every session
├── decisions/         # Architecture/tech decisions
├── gotchas/           # Mistakes to avoid repeating
└── preferences/       # User working style
```

**MEMORY.md format:**

```markdown
# Memory Index
- [decision-postgres.md](decisions/decision-postgres.md) — Why Postgres over SQLite
- [gotcha-hooks.md](gotchas/gotcha-hooks.md) — Hooks need absolute paths
```

---

## Subagents: Delegation

Write a `.md` file per specialized agent. Spawn with the `Agent` tool.

```markdown
---
name: implementer
model: claude-sonnet-4-6
---
Implement features from clear specs. Use LSP for navigation. Don't narrate — just work. Report blockers only.
```

**Delegate when:** clear spec, routine execution (feature implementation, refactors, boilerplate, test writing).
**Do it yourself:** architecture decisions, complex debugging, quick edits (< 3 files).
**The test:** Can you write a 3-sentence spec? If yes → delegate.

---

## Skills: Capabilities

A skill is `~/.claude/skills/[name]/SKILL.md`. Fires when description matches user intent.

```markdown
---
name: my-skill
description: Use when [trigger]. Triggers on: "[phrase 1]", "[phrase 2]". NOT for: [exclusion].
---
[Instructions]
```

The `description` is the routing signal. Bad description = skill never fires.

---

## Putting It Together

**The self-improving loop:**

```
Mistake happens → PostToolUse fires
    → Hook writes to memory/gotchas/[topic].md
    → Updates memory/MEMORY.md index

Next session → SessionStart fires
    → Hook loads MEMORY.md into context
    → Agent reads gotchas before acting
    → Mistake doesn't repeat
```

**Build order:**
1. Write CLAUDE.md with core behavioral rules
2. Create `~/.claude/memory/MEMORY.md` (start empty)
3. Write SessionStart hook that prints MEMORY.md
4. Write PostToolUse hook that saves discoveries after key actions
5. Run one real session — observe what gets captured
6. Add subagent configs as delegation needs emerge

See `references/self-improving-example.md` for the complete working implementation.

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I'll just use CLAUDE.md, I don't need hooks" | Hooks make behavior automatic. Without them, you rely on the model to remember rules every session. That's not autonomous — that's optimistic. |
| "I'll add memory later when I need it" | You'll lose the first N gotchas you needed most. Set the system up now, save nothing. It's ready when the moment arrives. |
| "My CLAUDE.md is getting long, it's fine" | Past 300 lines, rules get dropped. Split into stack files and reference them with `@path`. |
| "I'll just delegate everything to subagents" | Delegation has overhead. Do architectural decisions, complex debugging, and quick edits yourself. Delegate execution, not judgment. |
| "The self-improving loop sounds complicated" | Minimal version: 2 hooks + 1 memory file. Start there. Complexity is optional. |
