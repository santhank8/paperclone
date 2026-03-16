# Model Routing by Cost Tier

## When to Use

- "How do I cut my bill 10x?"
- "Claude Code is too expensive"
- "Which model should I use for this task?"
- You're spawning subagents and want to control cost

## Steps

Routing 80% of work to Haiku cuts effective cost 15x. The `Agent` tool's `model` parameter enforces this.

| Tier | Model | Use For | Relative Cost |
|------|-------|---------|---------------|
| Scout | Haiku | File search, grep, classification, filtering | 1× |
| Implement | Sonnet | Feature work, refactors, structured output | ~4× |
| Review | Opus | Architecture decisions, high-stakes review | ~15× |

**Enforce model in Agent spawns:**
```javascript
Agent({
  model: "haiku",
  prompt: "Search for all API endpoint definitions. Return file paths only."
})
```

**Routing rule:** mechanical search/filter → Haiku. Multi-step implementation → Sonnet. Architectural judgment → Opus.

## Verification

- You have model assignments for each type of subagent work in your pipeline
- Your Agent spawns include explicit `model` parameters

## Reference

See `../references/model-routing.md` for: delegation math, cost tables, common mistakes, and the JSON summary contract.
