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

## Entry Points

| Goal | Section |
|------|---------|
| Set up isolated parallel agents | [Isolation: Git Worktrees](#isolation-git-worktrees) |
| Coordinate agents without shared memory | [Coordination Without Shared Memory](#coordination-without-shared-memory) |
| Use SendMessage without it stalling | [SendMessage: Stable Pattern](#sendmessage-stable-pattern) |
| Control costs with model tiering | [Tiered Models + Cost Control](#tiered-models--cost-control) |
| Prevent parent context bloat | [Context Budget Management](#context-budget-management) |
| Pass rules to subagents | [CLAUDE.md Inheritance Gap](#claudemd-inheritance-gap) |
| Build a working pipeline | [Complete Example: 3-Agent Code Review](#complete-example-3-agent-code-review) |

---

## Isolation: Git Worktrees

Naive parallel agents corrupt each other. Two agents modifying the same branch = merge conflicts, git config lock contention, build collisions.

**Fix: one worktree per agent.** Each gets its own branch and working directory.

```bash
# Before spawning agents
git worktree add /tmp/agent-review-logic -b agent/review-logic
git worktree add /tmp/agent-review-security -b agent/review-security

# After agents complete, merge results
git merge agent/review-logic
git merge agent/review-security

# Cleanup
git worktree remove /tmp/agent-review-logic
git worktree remove /tmp/agent-review-security
git branch -d agent/review-logic agent/review-security
```

Spawn each agent with its worktree path in the prompt. They never touch the same files.

See `references/worktrees.md` for: full lifecycle, conflict patterns, and cleanup automation.

---

## Coordination Without Shared Memory

Agents don't share in-context state. The stable primitives are files.

**Task manifest** (`coordination/tasks.json`): what exists, who owns what.
**Status files** (`coordination/status-[agent].json`): agent writes `done` when complete.
**Result files** (`coordination/result-[agent].md`): structured output the orchestrator reads.

```json
// coordination/status-logic.json
{
  "agent": "logic-reviewer",
  "status": "done",
  "completedAt": "2026-03-15T18:00:00Z",
  "resultFile": "coordination/result-logic.md"
}
```

Orchestrator polls status files. When all are `done`, it reads results and aggregates.

**File-based vs. SendMessage:** Use files for result hand-off. Use SendMessage only for real-time control signals between a named orchestrator and named teammate. If you just need results, files are simpler and more reliable.

See `references/coordination.md` for: full task manifest format, polling patterns, and result aggregation.

---

## SendMessage: Stable Pattern

SendMessage is async. It's not a synchronous call. The known failure: stop polling → teammate stalls indefinitely (requires Esc to recover).

**Stable pattern:**
```
// Don't do this — bash sleep loop
while (!done) { sleep 5; check status }

// Do this — CronCreate for polling
CronCreate({ interval: "30s", command: "check coordination/status-*.json" })
```

**When to use SendMessage:**
- You need real-time control (pause/resume an agent mid-run)
- Long-running teammate needs orchestrator decisions during execution

**When to skip it:**
- Result hand-off — use result files instead
- Fire-and-forget agents — just wait for completion

See `references/coordination.md` for polling examples.

---

## Tiered Models + Cost Control

Don't spawn Opus for everything. Cascade by task complexity:

| Tier | Model | Use For | Relative Cost |
|------|-------|---------|---------------|
| Scout | Haiku | File discovery, classification, filtering | 1× |
| Implement | Sonnet | Feature work, analysis, structured output | ~4× |
| Validate | Opus | Architecture review, high-stakes decisions | ~15× |

**Enforce model choice in the spawn prompt** — subagents don't inherit your model preference.

```markdown
// In the subagent spawn prompt
You are running as claude-haiku-4-5. Only scan for changed files and classify
risk by area. Do NOT implement anything. Return a JSON summary under 500 tokens.
```

**Real cost comparison (4-file PR review):**
- All-Opus: ~$0.80 per review
- Tiered (Haiku scout + Sonnet×2 review): ~$0.12 per review

See `references/cost-control.md` for model selection rubric and cascade patterns.

---

## Context Budget Management

Every subagent result injected into the orchestrator burns parent context. This causes the 887k token/minute trap.

**The contract:** enforce in every subagent spawn prompt:
```
Return ONLY a JSON summary: status, findings (max 10), files_modified, blockers.
No diffs, no full file contents, no explanations.
```

Use `run_in_background: true` for long tasks where the orchestrator can do other work while waiting. See `references/cost-control.md` for templates and cost comparison tables.

---

## CLAUDE.md Inheritance Gap

**Subagents don't load your CLAUDE.md.** Encode critical rules directly in the spawn prompt — not as a reminder, as a hard requirement:

```
RULES: Use LSP not grep. Use bun not npm. Edit existing files.
Return structured JSON summary (see template).
```

Encode: tool selection rules, output format, model instructions. Skip: style preferences, session context.

---

## Complete Example: 3-Agent Code Review

Full working implementation in `references/pipeline-example.md`.

```
Scout (Haiku) → classifies changed files by risk
Logic Reviewer (Sonnet) → correctness, N+1s, null checks
Security Reviewer (Sonnet) → auth, injection, validation
Orchestrator → merges results → report.md
```

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
