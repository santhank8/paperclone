# Test Cases: multi-agent-coordination

## Trigger Tests (Should Fire)

These prompts should invoke the multi-agent-coordination skill:

| # | Prompt | Expected: Trigger? |
|---|--------|-------------------|
| T1 | "I want to coordinate multiple Claude Code agents for a large refactor" | YES |
| T2 | "How do I run parallel agents without blowing up my API costs?" | YES |
| T3 | "My agents keep corrupting each other's git branches — how do I fix that?" | YES |
| T4 | "I tried TeamCreate and got no output — the agent just never ran" | YES |
| T5 | "Build a fan-out fan-in pipeline for code review" | YES |
| T6 | "How do I route some tasks to Haiku and others to Opus from an orchestrator?" | YES |
| T7 | "SendMessage isn't working — my teammate is stalling" | YES |
| T8 | "I'm getting subagent context bloat — 887k tokens per minute" | YES |
| T9 | "My subagents don't follow my CLAUDE.md rules" | YES |
| T10 | "Set up git worktree isolation for two parallel agents" | YES |

## No-Fire Tests (Should NOT Trigger)

These should NOT invoke this skill:

| # | Prompt | Expected: Fire? |
|---|--------|----------------|
| N1 | "Build a single autonomous agent that learns from mistakes" | NO (→ autonomous-agent skill) |
| N2 | "Set up an MCP server for filesystem access" | NO (different skill) |
| N3 | "How do I use persistent memory between sessions?" | NO (→ persistent-memory skill) |
| N4 | "Configure Paperclip agent coordination for my company" | NO (→ paperclip skill) |
| N5 | "What's the best way to write a CLAUDE.md?" | NO (→ autonomous-agent skill) |

## Output Tests (When Triggered)

For each trigger test, verify the skill output includes:

| Assertion | Required in Output |
|-----------|-------------------|
| O1 | Mentions the 95% rule or cautions against naive parallelization | T1, T2 |
| O2 | Recommends git worktrees for file isolation | T3, T10 |
| O3 | Explicitly warns against `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` / `TeamCreate` | T4 |
| O4 | Provides concrete file-based coordination pattern (not just concept) | T5 |
| O5 | Mentions model tiering (Haiku/Sonnet/Opus) | T6 |
| O6 | Explains SendMessage async behavior and CronCreate polling alternative | T7 |
| O7 | References the summary contract to prevent context bloat | T8 |
| O8 | Explains CLAUDE.md inheritance gap and fix (encode in spawn prompt) | T9 |
| O9 | References `references/worktrees.md` or `references/pipeline-example.md` | T10 |
| O10 | Does NOT recommend deprecated `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` flag | All |

## Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-----------------|
| E1 | User already knows about worktrees but is asking about SendMessage | Jump to SendMessage section, don't re-explain worktrees |
| E2 | User asks about Paperclip multi-agent coordination specifically | Acknowledge this is Paperclip-specific, recommend paperclip skill |
| E3 | User has 2 agents that don't write files (read-only) | Skip worktree recommendation — only needed for file writers |
| E4 | User wants TeamCreate despite the warning | Acknowledge the warning, provide stable alternative, don't block them |
