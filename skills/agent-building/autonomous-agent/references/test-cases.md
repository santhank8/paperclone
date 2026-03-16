# Test Cases: autonomous-agent skill

## Trigger Tests (should invoke the skill)

| # | Prompt | Expected |
|---|--------|----------|
| T1 | "How do I build an autonomous agent in Claude Code?" | TRIGGER |
| T2 | "I want my Claude Code setup to learn from mistakes across sessions" | TRIGGER |
| T3 | "Help me set up PreToolUse and PostToolUse hooks" | TRIGGER |
| T4 | "How do I create agent memory that persists between sessions?" | TRIGGER |
| T5 | "I want to configure subagents for delegation" | TRIGGER |
| T6 | "Build me a self-improving agent without any external frameworks" | TRIGGER |
| T7 | "Set up CLAUDE.md rules for my agent" | TRIGGER |
| T8 | "Make Claude Code enforce project rules automatically" | TRIGGER |
| T9 | "I don't want to install ClawHub skills, how do I build this myself?" | TRIGGER |

## No-Trigger Tests (should NOT invoke the skill)

| # | Prompt | Expected |
|---|--------|----------|
| N1 | "Set up an MCP server for my project" | NO TRIGGER |
| N2 | "How do I use the spec loop?" | NO TRIGGER |
| N3 | "Coordinate agents with SendMessage" | NO TRIGGER |
| N4 | "What is Claude Code?" | NO TRIGGER |
| N5 | "Install a skill from ClawHub" | NO TRIGGER |

## Output Assertions

For each trigger test, the skill output should:
- [ ] Identify which primitive(s) are relevant to the user's goal
- [ ] Provide concrete, copy-paste-ready code (hooks, CLAUDE.md snippets)
- [ ] Not introduce external frameworks or dependencies
- [ ] Stay within scope (no MCP, no spec loop, no SendMessage)
- [ ] Include the self-improving loop reference when user asks for complete agent setup
- [ ] Point to `references/` for depth rather than inlining everything
