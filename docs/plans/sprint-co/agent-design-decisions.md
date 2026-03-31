# Agent Design Decisions

## Overview

This document explains the design rationale behind Sprint Co's agent architecture. Every decision here was made deliberately. Understanding the reasoning helps you extend and adapt the system correctly.

---

## Decision 1: Why 7 Agents Instead of 1 or 3?

### The Naive Approach
The simplest sprint system would be: one agent, receives brief, builds app, done. This fails because:
- One agent context fills up fast
- One agent can't parallelize
- One agent is not skeptical enough of its own work (the self-grading problem)

### The Minimal Approach (Anthropic's Blueprint)
Three agents: Planner, Generator, Evaluator. This works well. Sprint Co extends it.

### Why Sprint Co Uses 7

**Sprint Co adds specialization within each role:**

| Anthropic Role | Sprint Co Agents | Why Split |
|----------------|------------------|-----------|
| Planner | Product Planner | Single-purpose — deep product thinking only |
| — | Sprint Lead | Architecture is distinct from product planning |
| Generator | Engineer Alpha | Frontend specialization |
| Generator | Engineer Beta | Backend specialization (parallel) |
| Evaluator | QA Engineer | Single-purpose skeptic |
| — | Delivery Engineer | DevOps is separate from QA judgment |
| — | Sprint Orchestrator | Coordination is a distinct cognitive task |

**Key insight**: Sprint Lead is not Planner and not Engineer. Sprint Lead reads the product spec and translates it into engineering reality. This translation step is where most product-engineering miscommunication happens. Making it explicit improves quality.

**Key insight**: Delivery Engineer is not QA. QA makes judgment calls. Delivery executes procedures. Different cognitive modes, different agents.

---

## Decision 2: Why Separate Evaluator? (The GAN Principle)

This is the most important architectural decision.

### The Problem with Self-Evaluation
When a generator evaluates its own output, it consistently gives itself more credit than it deserves. This is not dishonesty — it's a cognitive bias called "self-serving attribution." The evaluator doesn't consciously try to pass bad work; it just *sees* the work differently because it knows the intent behind every decision.

This is exactly what happens with AI agents. An agent that built a feature knows *why* it made every choice. When it evaluates, it grades on a curve. "The error handling is basic but I ran out of context" is a thought a generator has. An evaluator seeing the same feature cold would say "error handling is missing."

### The GAN Solution
In Generative Adversarial Networks (GANs), a discriminator separately judges the generator's output. The adversarial setup creates pressure that forces the generator to improve.

Sprint Co implements this structurally:
- QA Engineer is a **different agent** than Engineer Alpha/Beta
- QA Engineer is explicitly instructed to **lean toward failing** (skeptical by default)
- QA Engineer and Engineers **cannot see each other's internal reasoning** — only artifacts
- After 2 QA failures, Sprint Orchestrator intervenes (not QA or Engineer)

The result: QA creates genuine adversarial pressure. Engineers produce better work because they know QA will actually push back.

### Why Not Use a Different Person?
Paperclip agents share the same underlying model. The key is the **system prompt and role instructions**, not fundamentally different capabilities. QA Engineer's instructions create a meaningfully different evaluative stance.

---

## Decision 3: Why Haiku as the Default Model?

### Speed vs Quality Tradeoff
In a 3-hour sprint:
- Total compute budget matters — slower models = fewer iterations
- Speed enables more QA cycles = better product through more feedback loops
- Haiku is 3-5x faster and 10x cheaper than Sonnet

### What Haiku is Good At
Haiku handles structured, well-specified tasks extremely well:
- "Write a React component that does X" → Haiku does this fine
- "Grade this feature against these 4 criteria" → Haiku does this fine
- "Read this sprint plan and scaffold a repo" → Haiku does this fine

### When Haiku Falls Short
Haiku struggles with:
- Open-ended reasoning with many tradeoffs
- Deep debugging of non-obvious bugs
- Creative judgment calls (aesthetics, naming, design)

For these, Sprint Co escalates to Sonnet or Opus.

### Why Haiku Doesn't Need Context Resets
Haiku has less "context anxiety" than Sonnet. Sonnet models near the end of their context window show degraded coherence — they become repetitive, they forget earlier constraints, they drift from instructions. Haiku is more stable near context limits.

This means Haiku agents can run longer before needing a context reset, which reduces handoff overhead.

---

## Decision 4: Why Sprint-Based, Not Continuous?

### The Alternative: Continuous Operation
An alternative design would have agents running continuously — always monitoring, always building. This sounds appealing but has serious problems:

- **Runaway scope**: Without a deadline, systems tend to keep adding features
- **No forcing function for quality**: Continuous work doesn't create the pressure that makes you ship
- **Cost**: 24/7 agent operation is expensive; most of it would be idle polling
- **Auditability**: Continuous operation is harder to review and understand

### Why Sprints Work
Sprints create several important constraints:
1. **Deadline pressure**: 3 hours forces prioritization decisions
2. **Clear start/end**: Jeremy knows when to expect a result
3. **Scope control**: The sprint plan defines a bounded deliverable
4. **Cost control**: A sprint costs money; idle time costs nothing
5. **Natural handoff points**: The sprint report is a natural review moment

### The Sprint Length Choice
3 hours is the Goldilocks zone:
- Too short (1 hour): Not enough time for a meaningful full-stack feature
- Too long (8 hours): Context limits become a real problem; sprint loses urgency
- 3 hours: Enough for 2–4 features, fits in a focused session, urgent enough to prioritize

---

## Decision 5: Why Handoff Artifacts Instead of Shared Memory?

### The Problem with Shared Memory
In multi-agent systems, a common approach is shared memory (a database or context store all agents read from). Problems:
- Agents must poll for updates (wasteful)
- Race conditions when multiple agents write simultaneously
- Difficult to audit what happened when

### Handoff Artifacts as Immutable Messages
Sprint Co uses handoff artifacts: structured markdown files written by one agent, read by the next. Benefits:
- Immutable: once written, an artifact doesn't change (prevents confusion)
- Auditable: you can read the complete sprint history as a series of documents
- Lightweight: markdown files, no infrastructure required
- Context-reset-safe: a new session can reconstruct state from artifacts alone

### The Format Discipline
Every artifact follows the same format (see sprint-protocol skill). This discipline is critical — an agent that receives a non-standard artifact has to spend time parsing it, which is waste.

---

## Decision 6: Why the Sprint Orchestrator?

### The Problem Without an Orchestrator
Without a coordinator, who:
- Tracks the global sprint clock?
- Handles blockers that span multiple agents?
- Makes the hard call to drop a V1 feature?
- Reports to Jeremy?

Each agent would need to poll for status, coordinate independently, and somehow agree on global time. This is the distributed systems consensus problem in agent form.

### Why a Dedicated Orchestrator Solves This
Sprint Orchestrator owns:
- The sprint clock (one clock, one owner)
- The communication channel to Jeremy (one reporting agent)
- Blocker escalation (when an agent is stuck, they escalate to one place)
- Feature-dropping decisions (one agent has authority)

The Orchestrator does NOT implement features. It has no implementation responsibilities. This separation of coordination from execution is important — an agent doing both tends to bias toward its current task and neglect coordination.

---

## Decision 7: Why Not Autonomous Sprint Initiation?

Sprint Co does not automatically start sprints on a schedule. Sprints are initiated by Jeremy (sending a brief).

**Why**:
- Autonomous sprint initiation without a brief would produce generic, self-directed work
- Jeremy's brief defines the value being delivered
- Sprint Co is a tool for Jeremy, not a system pursuing its own agenda

This is also aligned with Anthropic's constitution: AI systems should maintain human oversight. Sprint Co exists to serve Jeremy's goals, not to autonomously generate software for its own reasons.
