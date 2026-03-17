---
name: multi-agent-coordination
description: Use when coordinating multiple Claude Code agents, running agents in parallel, or building multi-agent pipelines. Triggers on: "coordinate agents", "parallel agents", "multi-agent", "agent pipeline", "fan-out fan-in", "spawn multiple agents", "parallelize work", "agent teams", "haiku sonnet opus routing", "subagent cost explosion", "worktree isolation", "agents corrupting each other", "agents modifying same files", "SendMessage stalling". Also fires for: planner/implementer/reviewer pipelines, cost control on parallel agents, CLAUDE.md inheritance gaps in subagents, and coordination without shared memory. NOT for: single-agent setup (see autonomous-agent skill), MCP server configuration, or Paperclip-specific orchestration.
---

# Coordinate Multiple Claude Code Agents

Parallel agents deliver real leverage — but only after you've solved three problems: isolation, coordination, and cost control. Skip any one and you get file collisions, blown API budgets, or silent agent failures.

**This skill uses only the stable `Agent` tool. Not `TeamCreate`. Not `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`.** Those are actively buggy (silent fallbacks, SendMessage loss, exit races). Skip them.

## The 95% Rule: Parallelize Only When It Earns Its Keep

**Single agent wins for most tasks.** The parallelization tax is real — context handoff, result aggregation, isolation setup. Multi-agent only pays when ALL of these are true:

- [ ] Tasks are genuinely independent (different files, different domains)
- [ ] The combined single-agent time clearly exceeds multi-agent overhead
- [ ] You need different models (Haiku for scanning, Opus for validation)
- [ ] Blast radius isolation is worth the worktree setup

If you're parallelizing to feel productive: don't. The 887k-token/minute case happened because someone naively spawned 49 agents.

## Isolation: Git Worktrees

Naive parallel agents corrupt each other — git lock contention, build collisions, merge conflicts. Fix: one worktree per agent, each on its own branch. Spawn each agent with its worktree path in the prompt.

See `references/worktrees.md` for: full lifecycle, conflict patterns, and cleanup automation.

---

## Coordination Without Shared Memory

Agents don't share in-context state. Three file primitives: **task manifest** (`coordination/tasks.json`) defines scope, **status files** (`coordination/status-[agent].json`) signal `done`/`blocked`/`failed`, **result files** (`coordination/result-[agent].md`) carry structured output. Orchestrator polls status files; when all are `done`, reads results and aggregates. Use files for results, SendMessage only for real-time control signals.

See `references/coordination.md` for: full task manifest format, polling patterns, and result aggregation.

---

## SendMessage: Stable Pattern

SendMessage is async — the known failure: teammate exits its polling loop, messages pile up, no error surfaced (requires Esc to recover). Use CronCreate for polling instead of bash sleep loops. Skip SendMessage entirely for result hand-off or fire-and-forget agents — files are simpler and don't stall.

See `references/coordination.md` for polling examples.

---

## Tiered Models + Cost Control

Cascade by task complexity: Haiku (1×) for discovery/filtering, Sonnet (~4×) for analysis/implementation, Opus (~15×) for architecture/high-stakes validation only. **Enforce model in the spawn prompt** — subagents don't inherit your model preference. Tiered approach is ~9× cheaper than naive all-Opus parallel (real example: $0.10 vs $0.90 per PR review).

See `references/cost-control.md` for model selection rubric, spawn prompt template, and cascade patterns.

---

## Context Budget Management

Every subagent result injected into the orchestrator burns parent context — this causes the 887k token/minute trap. Enforce a JSON summary contract in every spawn prompt: `status`, `findings` (max 10), `files_modified`, `blockers` — no diffs, no full file contents. Use `run_in_background: true` for long tasks. Target under 500 tokens per agent result.

See `references/cost-control.md` for the full summary contract template and cost comparison tables.

---

## CLAUDE.md Inheritance Gap

**Subagents don't load your CLAUDE.md.** Encode critical rules directly in the spawn prompt as hard requirements: tool selection (LSP not grep, bun not npm), output format (JSON summary contract), model instructions. Skip style preferences and session context.

---

## Complete Example: 3-Agent Code Review

Full working implementation (spawn prompts, aggregation, cleanup) in `references/pipeline-example.md`. Pattern: Scout (Haiku) classifies files → Logic + Security Reviewers (Sonnet) run in parallel → Orchestrator merges results → `report.md`.

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "More agents = faster" | The 95% rule exists for a reason. Single agent wins for most tasks. Measure before parallelizing. |
| "TeamCreate is simpler to set up" | It's experimentally buggy. Silent exits, SendMessage loss, MCP routing failures all documented in open issues. Use `Agent` tool. |
| "I'll add worktrees if there's a conflict" | By then you've already lost work. Set them up before spawning. |
| "Subagents will follow my CLAUDE.md" | They won't. They don't load it. Encode rules in the spawn prompt — no exceptions. |
| "I'll just pass the full transcript back" | Full transcripts = parent context bloat = 887k tokens/minute. Enforce the JSON summary contract. |
| "SendMessage is simpler than files" | Until it stalls. Files don't stall. Use files for results, SendMessage only for real-time control. |
