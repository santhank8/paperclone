# Model Strategy

## Overview

Sprint Co uses a tiered model strategy. The default is `anthropic/claude-haiku-4-5` — fast, cheap, and capable enough for structured sprint work. Escalation to Sonnet or Opus is reserved for specific tasks where higher reasoning quality materially changes the output.

---

## Default: claude-haiku-4-5

**Used by**: All agents  
**When**: All routine sprint tasks

### Why Haiku is the Default

1. **Speed**: Haiku responds 3–5x faster than Sonnet. In a 3-hour sprint, faster iteration means more QA cycles and better final output.

2. **Cost**: Haiku costs ~10x less per token. A full 3-hour sprint involving 7 agents with structured outputs can easily consume 500k–1M tokens. At Sonnet prices, this gets expensive fast.

3. **Task fit**: Most sprint tasks are **structured and specific**. "Write a React component that renders a task list from an API" is not a task that requires deep reasoning — it requires reliable execution of a well-specified instruction. Haiku does this well.

4. **Context stability**: Haiku is more stable near the end of its context window than Sonnet. Sonnet models show signs of "context anxiety" — they repeat themselves, forget earlier constraints, and lose coherence. Haiku degrades more gracefully, meaning agents can run longer before needing a reset.

### What Haiku Handles Well
- Writing React components, API routes, database schemas
- Reading and following structured instructions (handoff artifacts, sprint plans)
- Generating structured markdown output (reports, critiques, plans)
- Code scaffolding and boilerplate
- Straightforward debugging of explicit error messages

### What Haiku Struggles With
- Open-ended reasoning with many competing considerations
- Deep debugging of non-obvious bugs (e.g., race conditions, subtle type errors)
- Aesthetic / creative judgment calls
- Novel architectural problems with no clear best practice

---

## Escalation 1: claude-sonnet-4-5

**When to escalate to Sonnet**:

| Situation | Agent | Rationale |
|-----------|-------|-----------|
| Complex architectural decision with significant downstream consequences | Sprint Lead | Wrong call here cascades through the entire sprint |
| Non-obvious bug that Haiku has attempted to fix twice and failed | Engineer Alpha/Beta | Haiku may be missing something Sonnet would catch |
| Integration with a third-party API with poor documentation | Engineer Beta | Requires reading between the lines and reasoning about underdocumented behavior |
| Sprint plan requires navigating genuinely ambiguous requirements | Product Planner | Scope ambiguity requires nuanced judgment |

### How to Escalate
1. Note that you're escalating and why in the sprint log
2. Create a fresh session with the higher model
3. Provide the same context (handoff artifact + relevant files)
4. Complete the specific task
5. Return to Haiku for subsequent work

Escalation is task-scoped, not session-wide. Switch to Sonnet for the hard task, then back to Haiku.

---

## Escalation 2: claude-opus-4-6

**When to escalate to Opus**:

| Situation | Agent | Rationale |
|-----------|-------|-----------|
| Borderline QA scores requiring genuine aesthetic judgment | QA Engineer | "Is this 5/10 or 6/10 on Visual Design?" needs higher-quality judgment |
| Creative/product decisions that define the product's character | Product Planner | What the product IS, not just how it works |
| Sprint Orchestrator needs to make a hard prioritization call | Orchestrator | Dropping a V1 feature needs principled reasoning |

### Opus Notes

Opus 4.5+ has a key property: it does **not** need context resets the way Sonnet does. Opus maintains coherence across long contexts. This makes it especially valuable for:
- Long evaluation sessions (QA testing multiple features)
- Complex product planning where the spec builds on itself

Opus is expensive. Use it only for the specific tasks listed above. A full sprint should not require more than 1–2 Opus escalations.

---

## Context Reset Guidelines

### Sonnet
Sonnet shows context degradation around 80k tokens. Signs:
- Repeating instructions that were already completed
- Forgetting earlier constraints (e.g., re-adding a feature that was explicitly scoped out)
- Circular reasoning on a task it's been stuck on

If you see these signs in a Sonnet session, **reset immediately**. Produce the handoff artifact, fresh session, read the artifact.

### Haiku
Haiku is more stable. Reset at:
- 100k+ tokens in a session
- End of any major phase (even if context hasn't grown that large)
- Any time the agent seems confused about prior decisions

### Opus
Opus does not need resets based on context length alone (per Anthropic's blueprint). Still reset at:
- End of major phases (for auditability)
- If something genuinely goes wrong

---

## Cost Estimation Per Sprint

**Typical sprint token usage** (rough estimates):

| Phase | Agent | Model | Est. Tokens | Est. Cost |
|-------|-------|-------|-------------|-----------|
| Planning | Product Planner | Haiku | 30k | ~$0.02 |
| Architecture | Sprint Lead | Haiku | 20k | ~$0.01 |
| Implementation (2 engineers, 3 features each) | Alpha + Beta | Haiku | 300k | ~$0.19 |
| QA (3 features, 1 revision cycle) | QA Engineer | Haiku | 80k | ~$0.05 |
| Deployment | Delivery Engineer | Haiku | 15k | ~$0.01 |
| Coordination | Orchestrator | Haiku | 25k | ~$0.02 |
| **Escalations (2x)** | Various | Sonnet/Opus | 50k | ~$0.50 |
| **Total** | | | ~520k | **~$0.80** |

A full 3-hour sprint should cost roughly **$0.50–$2.00** in model API costs, depending on complexity and escalation frequency.

---

## Model Selection Quick Reference

```
Default situation → claude-haiku-4-5
  ↓
Complex architectural decision → claude-sonnet-4-5 (task-scoped)
  ↓
Non-obvious bug, 2+ failed attempts → claude-sonnet-4-5 (task-scoped)
  ↓
Aesthetic/creative judgment calls → claude-opus-4-6 (task-scoped)
  ↓
Borderline QA score, high stakes → claude-opus-4-6 (task-scoped)
```

---

## Adapter Configuration

All Sprint Co agents use:
- **Adapter**: `claude_local` (OpenClaw-managed Claude Code token)
- **Base URL**: Managed by OpenClaw

The `claude_local` adapter routes all model calls through OpenClaw's Claude Code integration. Model selection (haiku/sonnet/opus) is specified per-call via the `model` field in the agent config or request.

To escalate within a session, the agent should signal the Sprint Orchestrator with the requested model upgrade. Orchestrator spawns a new sub-session with the higher model and provides the handoff artifact.
