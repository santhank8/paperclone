# Skill Brief: Build Your Own Autonomous Agent Inside Claude Code

## Demand Signal

- ClawHub "self-improving-agent" has 224k downloads — #1 skill by far
- "ontology" (structured agent memory) has 107k downloads — #2
- "self-improving" (self-reflection + self-learning) has 73k — #4
- Combined: 400k+ downloads for agent-building capabilities
- All three are third-party frameworks that add overhead Claude Code doesn't need
- OpenClaw GitHub issues show users struggling with skill installation, version conflicts, and framework lock-in
- YouTube search for "Claude Code agent" returns mostly surface-level content — no one is teaching the native primitives end to end

## Target Audience

Developers who use Claude Code daily and want their setup to:
- Learn from mistakes across sessions
- Enforce project rules automatically
- Delegate routine work to specialized subagents
- Persist knowledge without external tools

They've seen the ClawHub skills but don't want another dependency. They want to understand the system well enough to build it themselves.

## Core Thesis

Claude Code already has everything you need to build an autonomous, self-improving agent. No framework required. The primitives are:

| Primitive | What It Does |
|-----------|-------------|
| CLAUDE.md | Persistent instructions — your agent's brain |
| Skills (.md) | Reusable workflows — your agent's capabilities |
| Hooks (PreToolUse, PostToolUse, SessionStart, Stop) | Event-driven automation — your agent's reflexes |
| Subagents (Agent tool + .md configs) | Delegation — your agent's team |
| Memory files | Persistent knowledge — your agent's long-term memory |
| MCP servers | External tool access — your agent's hands |

The skill teaches how these six primitives compose into an autonomous system.

## Skill Scope

### In Scope
- Setting up CLAUDE.md with behavioral rules and delegation logic
- Writing a PreToolUse hook that enforces project standards
- Writing a PostToolUse hook that captures metrics/learnings
- Creating a SessionStart hook that loads context from prior sessions
- Building a memory system using file-based persistence
- Configuring a subagent (.md file) for a specific task
- Spawning and coordinating subagents from the orchestrator
- A working example: self-improving agent that captures mistakes and avoids repeating them

### Out of Scope
- MCP server setup (separate skill)
- Spec loop orchestration (advanced — separate skill)
- Team coordination with SendMessage (separate skill)
- Deployment/hosting (not relevant — Claude Code runs locally)
- OpenClaw/ClawHub integration

## Sections

1. **The Architecture** — How the six primitives fit together. Mental model: CLAUDE.md is the brain, hooks are reflexes, skills are capabilities, subagents are delegation, memory is persistence, MCP is reach.

2. **CLAUDE.md: Your Agent's Brain** — Structure, what goes in it, how to organize rules vs. preferences vs. stack-specific overrides. Global (~/.claude/CLAUDE.md) vs. project-level.

3. **Hooks: Your Agent's Reflexes** — PreToolUse for rule enforcement, PostToolUse for learning capture, SessionStart for context loading. Working examples of each. How to register in settings.json.

4. **Memory: Your Agent's Long-Term Knowledge** — File-based memory system. What to save (decisions, gotchas, user preferences). When to save (after discoveries, corrections, milestones). How to organize (by type, not chronologically).

5. **Subagents: Your Agent's Team** — Writing an agent .md file. Model selection (opus vs. sonnet vs. haiku). Tool restrictions. How to spawn from the orchestrator. When to delegate vs. do it yourself.

6. **Skills: Your Agent's Capabilities** — SKILL.md format. Trigger descriptions. How skills get invoked. Building a skill that wraps a complex workflow into a single command.

7. **Putting It Together: A Self-Improving Agent** — Walk through building an agent that: captures mistakes via PostToolUse hook → saves them to memory → loads them on SessionStart → avoids repeating them. The complete loop.

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Have a CLAUDE.md that defines their agent's behavior
- [ ] Have at least one hook enforcing a project rule automatically
- [ ] Have a memory system that persists learnings across sessions
- [ ] Have one subagent configured for delegation
- [ ] Understand how to add new capabilities without external frameworks

## Keywords

claude code agent, autonomous agent, self-improving agent, claude code hooks, claude code skills, CLAUDE.md, agent memory, subagents, no framework agent

## Competitive Positioning

| Their Approach | Our Approach |
|---------------|-------------|
| Install self-improving-agent from ClawHub | Build it yourself with native hooks + memory |
| Depend on ontology package for memory | File-based memory with your own schema |
| Framework updates may break your setup | You own every line — nothing to update |
| One-size-fits-all behavior | Tuned to your exact workflow |

## Estimated Complexity

Medium. No external dependencies. All primitives are documented. The skill is teaching composition of existing features, not introducing new ones.
