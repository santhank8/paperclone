# Tiered Models and Context Budget Management

## The Model Tier

| Tier | Model ID | Context | Best For | Relative Cost |
|------|----------|---------|----------|---------------|
| Scout | `claude-haiku-4-5-20251001` | 200k | Discovery, filtering, classification, routing | 1× |
| Implement | `claude-sonnet-4-6` | 200k | Feature work, analysis, structured output, most reviews | ~4× |
| Validate | `claude-opus-4-6` | 200k | Architecture decisions, high-stakes security reviews, final validation | ~15× |

## Cascade Pattern

```
Scout (Haiku) → filters 100 files down to 8 changed files with risk scores
Implementers (Sonnet ×N) → parallel, each reviews its subset
Validator (Opus) → reads merged summary, gives final sign-off
```

The cascade minimizes Opus usage. Opus sees the already-filtered, already-summarized output. It never touches raw files.

## Enforcing Model Choice

**Subagents don't inherit your model setting.** Enforce it in the spawn prompt:

```markdown
You are running as claude-haiku-4-5-20251001 (Haiku).
Your only job is file discovery and risk classification.
Do NOT perform any implementation or deep analysis.
Do NOT spawn additional agents.
Return ONLY the JSON summary format below — no prose, no explanation.
```

If you don't specify, the Agent tool defaults to whatever model the parent is using — which is expensive if you're on Opus.

## The Summary Contract

Every subagent result injected into the orchestrator burns parent context. The JSON summary contract prevents the 887k-token/minute trap.

**Enforce this in every subagent spawn prompt:**

```markdown
At the end of your work, output ONLY this JSON block and nothing else:

```json
{
  "status": "done" | "blocked" | "failed",
  "summary": "One sentence describing what you found/did",
  "findings": ["finding 1", "finding 2"],  // max 10 items
  "files_modified": ["path/to/file"],       // empty array if read-only
  "blockers": ["blocker description"]       // empty array if none
}
```

Do NOT include code diffs, full file contents, long explanations, or tool call transcripts.
```

**Summary size target:** Under 500 tokens per agent result. For 5 parallel agents, that's 2,500 tokens injected back to the orchestrator — manageable. Without the contract, agents return full analysis including code snippets = 5,000–20,000 tokens each.

## Real Cost Comparison

**PR review: 4 files, ~500 lines of code**

| Strategy | Agents | Tokens (est.) | Cost (est.) |
|----------|--------|--------------|-------------|
| All-Opus, single agent | 1 | ~60k | ~$0.90 |
| All-Opus, parallel | 3 | ~60k × 3 | ~$2.70 |
| Tiered: Haiku scout + Sonnet×2 | 3 | Haiku ~5k + Sonnet ~30k | ~$0.12 |
| Tiered + summary contract | 3 | Same + smaller summaries | ~$0.10 |

The tiered + summary approach is ~9× cheaper than naive all-Opus parallel.

## Background vs. Foreground Agents

```
// Background — fire and forget, check status later
Agent({
  prompt: "...",
  subagent_type: "general-purpose",
  run_in_background: true
})

// Foreground — block until done, result returned immediately
Agent({
  prompt: "...",
  subagent_type: "general-purpose"
})
```

**Use background when:**
- Long-running tasks (> 2 minutes) where orchestrator can do other work
- Multiple independent agents — spawn all background, then poll status files

**Use foreground when:**
- You need the result before proceeding
- Sequential pipeline steps (A must finish before B starts)

## Budget Guard Prompts

Add to orchestrator preamble when cost control is critical:

```markdown
BUDGET RULES:
- You have a budget of $0.50 for this run
- Spawn Haiku for any task that is discovery/filtering/classification
- Spawn Sonnet for any task that requires analysis or implementation
- Spawn Opus ONLY if security or architecture validation is explicitly required
- If you're unsure which tier, default to Sonnet
- Report estimated token usage in your final summary
```

## The 887k Token/Minute Case

This happened with 49 subagents, each running Opus, each returning full transcripts. The failure modes combined:
1. No model tiering — all Opus
2. No summary contract — full transcripts returned
3. No parallelization gate — spawned all 49 at once
4. No background flag — all foreground, blocking orchestrator

Prevention: apply all four controls before spawning more than 3 agents.
