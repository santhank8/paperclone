# Test Cases: structured-project-workflow

## Trigger Tests (Should Fire)

| ID | Prompt | Expected | Confidence |
|---|---|---|---|
| T1 | "how do I structure my Claude Code project" | TRIGGER | 95% |
| T2 | "I want a structured workflow from idea to shipped product" | TRIGGER | 98% |
| T3 | "set up TASK.md for my project" | TRIGGER | 85% |
| T4 | "spec-driven development in Claude Code" | TRIGGER | 90% |
| T5 | "I keep losing context between Claude Code sessions" | TRIGGER | 80% |
| T6 | "no jira claude code project management" | TRIGGER | 90% |
| T7 | "PRD template for Claude Code" | TRIGGER | 85% |
| T8 | "plan mode for project planning" | TRIGGER | 80% |
| T9 | "my Claude Code project keeps drifting, how do I fix it" | TRIGGER | 85% |
| T10 | "how do I use CLAUDE.md for project notes" | TRIGGER | 75% |
| T11 | "5-phase development workflow" | TRIGGER | 80% |
| T12 | "idea to shipped product with Claude" | TRIGGER | 90% |

## No-Trigger Tests (Should NOT Fire)

| ID | Prompt | Expected | Confidence |
|---|---|---|---|
| N1 | "how do I write tests in Claude Code" | NO FIRE | 90% |
| N2 | "set up git worktrees" | NO FIRE | 85% |
| N3 | "configure an MCP server" | NO FIRE | 95% |
| N4 | "set up multi-agent coordination" | NO FIRE | 85% |
| N5 | "what is a PRD" (generic, no Claude Code context) | NO FIRE | 70% |

## Output Assertions

For each triggered test, verify output contains:

| Assertion | What to Check |
|---|---|
| 5-phase lifecycle table present | Quick Entry table in SKILL.md body |
| 8 reference file links | All 8 entries in Quick Entry table |
| TASK.md template shown | Via references/03-phase2-spec-to-tasks.md |
| CLAUDE.md invariant guidance | Via references/07-claude-md-project-brain.md |
| Anti-rationalization table (6 entries) | In main SKILL.md body |
| No external tool dependencies | SKILL.md says "no Jira/Linear/Notion" |
| gh CLI for Phase 5 | Via references/06-phase5-ship-it.md |
| Plan mode integration | Phase 1 and 3 reference files |
