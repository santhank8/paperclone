# Verify: Autonomous Agent

## File Check
- [ ] `~/.claude/skills/autonomous-agent/SKILL.md` exists
- [ ] `~/.claude/skills/autonomous-agent/references/hooks.md` exists
- [ ] `~/.claude/skills/autonomous-agent/references/self-improving-example.md` exists

## Trigger Tests
Try these prompts — the skill should fire:
- [ ] "How do I build an autonomous agent in Claude Code?" → skill activates
- [ ] "I want my Claude Code setup to learn from mistakes across sessions" → skill activates
- [ ] "Help me set up PreToolUse and PostToolUse hooks" → skill activates
- [ ] "How do I create agent memory that persists between sessions?" → skill activates
- [ ] "I want to configure subagents for delegation" → skill activates
- [ ] "Build me a self-improving agent without any external frameworks" → skill activates
- [ ] "Set up CLAUDE.md rules for my agent" → skill activates
- [ ] "Make Claude Code enforce project rules automatically" → skill activates
- [ ] "I don't want to install ClawHub skills, how do I build this myself?" → skill activates

## No-Fire Tests
Try these prompts — the skill should NOT fire:
- [ ] "Set up an MCP server for my project" → skill does NOT activate
- [ ] "How do I use the spec loop?" → skill does NOT activate
- [ ] "Coordinate agents with SendMessage" → skill does NOT activate
- [ ] "What is Claude Code?" → skill does NOT activate
- [ ] "Install a skill from ClawHub" → skill does NOT activate

## Quick Smoke Test
1. Open Claude Code
2. Type: "How do I build an autonomous agent in Claude Code?"
3. Verify the skill activates and provides relevant guidance
4. Confirm output references the correct primitives for the goal

## Troubleshooting
- **Skill doesn't trigger:** Check that SKILL.md is at `~/.claude/skills/autonomous-agent/SKILL.md`. Restart Claude Code.
- **Partial functionality:** Verify all reference files copied. Check for missing MCP servers.
- **Unexpected behavior:** Check `~/.claude/skill-customizations/autonomous-agent/` for overrides.
