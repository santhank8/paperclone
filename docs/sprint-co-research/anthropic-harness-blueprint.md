# Harness Design for Long-Running Application Development

**Article by:** Prithvi Rajasekaran, Anthropic Labs  
**Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps

---

## Overview

Over the past several months, work has focused on two interconnected problems:
1. Getting Claude to produce high-quality frontend designs
2. Getting Claude to build complete applications without human intervention

This work originated from earlier efforts on the [frontend design skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) and [long-running coding agent harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), where prompting and harness design improved Claude's performance—but both eventually hit ceilings.

To break through, novel AI engineering approaches were sought that held across two different domains: one defined by subjective taste (design), the other by verifiable correctness (coding). Taking inspiration from **Generative Adversarial Networks (GANs)**, a multi-agent structure with a generator and evaluator agent was designed.

The final result was a **three-agent architecture**—planner, generator, and evaluator—that produced rich full-stack applications over multi-hour autonomous coding sessions.

---

## Why Naive Implementations Fall Short

### Problem 1: Context Coherence

Models tend to lose coherence on lengthy tasks as the context window fills. Some models also exhibit **"context anxiety,"** in which they begin wrapping up work prematurely as they approach what they believe is their context limit.

**Two approaches exist:**
- **Context Resets:** Clear the context window entirely and start a fresh agent, combined with structured handoff that carries previous state and next steps. Provides a clean slate at the cost of handoff artifact complexity.
- **Context Compaction:** Summarize earlier parts of the conversation in place so the same agent can keep going. Preserves continuity but doesn't give the agent a clean slate—context anxiety can still persist.

**Finding:** Claude Sonnet 4.5 exhibited context anxiety strongly enough that compaction alone wasn't sufficient for strong long-task performance. Context resets became essential to the harness design. **However, Claude Opus 4.5 largely removed that behavior on its own**, allowing the harness to run as one continuous session with automatic compaction.

### Problem 2: Self-Evaluation Bias

When asked to evaluate their own work, agents tend to confidently praise it—even when quality is mediocre. This is especially pronounced for subjective tasks like design. Separating the agent doing the work from the agent judging it proves to be a strong lever.

**Key insight:** While an external evaluator (still an LLM) is inclined to be generous toward LLM-generated outputs, tuning a standalone evaluator to be skeptical is far more tractable than making a generator critical of its own work. Once external feedback exists, the generator has something concrete to iterate against.

---

## Frontend Design: Making Subjective Quality Gradable

### Two Core Insights

1. **Aesthetics can be made gradable:** While individual tastes vary, quality can be improved with grading criteria that encode design principles. "Does this follow our principles for good design?" is more concrete than "Is this beautiful?"

2. **Separation enables feedback loops:** By separating frontend generation from frontend grading, a feedback loop can be created that drives the generator toward stronger outputs.

### Four Design Grading Criteria

These criteria were given to both generator and evaluator:

1. **Design Quality:** Does the design feel like a coherent whole rather than a collection of parts? Strong work means colors, typography, layout, imagery, and other details combine to create a distinct mood and identity.

2. **Originality:** Evidence of custom decisions, or template layouts and library defaults? A human designer should recognize deliberate creative choices. Unmodified stock components or telltale AI-generation patterns (e.g., purple gradients over white cards) fail here.

3. **Craft:** Technical execution—typography hierarchy, spacing consistency, color harmony, contrast ratios. A competence check; most reasonable implementations do fine by default.

4. **Functionality:** Usability independent of aesthetics. Can users understand what the interface does, find primary actions, and complete tasks?

**Emphasis:** Design quality and originality were weighted more heavily than craft and functionality (where Claude already performed well by default).

### Key "Museum Quality" Insight

The wording of the criteria steered the generator in unexpected ways. Including phrases like **"the best designs are museum quality"** pushed designs toward a particular visual convergence, suggesting that the prompting associated with the criteria directly shaped the character of the output.

### Implementation

- **Generator agent** created HTML/CSS/JS frontend based on user prompt
- **Evaluator agent** used Playwright MCP to interact with live page directly before scoring
- **Iteration loop:** 5-15 iterations per generation, with evaluator feedback driving refinement
- **Strategic decision:** Generator decided whether to refine current direction or pivot to entirely different aesthetic
- **Result:** Evaluator assessments improved over iterations before plateauing, with patterns ranging from incremental refinement to sharp aesthetic turns

---

## Scaling to Full-Stack Coding: Three-Agent Architecture

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Prompt                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  PLANNER AGENT         │
            │  (1-4 sentence prompt→ │
            │   full product spec)   │
            └────────────┬───────────┘
                         │
                         ▼
            ┌─────────────────────────┐
            │  GENERATOR AGENT        │
            │  (Implements features   │
            │   per sprint contract)  │
            └────────┬────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    Git Commits       Sprint Contract
    Features          (via files)
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
            ┌─────────────────────────┐
            │  EVALUATOR AGENT (QA)   │
            │  (Tests via Playwright, │
            │   grades against spec)  │
            └────────┬────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
      PASS              FEEDBACK  │
         │                        │
         ▼                        ▼
    Merged                 Generator iterates
    to main                 (return to build)
```

### Agent Roles

#### Planner Agent

- Takes simple 1-4 sentence prompt and expands into full product spec
- Remains ambitious about scope
- Focuses on product context and high-level technical design, NOT granular implementation details
- If planner specifies detailed technical details incorrectly, errors cascade downstream
- Constraint: spec defines deliverables, agents figure out the path
- Weaves AI features into product specs

**Why this helps:** Without planning, generator under-scopes. Given raw prompt, it starts building without speccing work first.

#### Generator Agent

- Works in **sprint-based decomposition**: picks up one feature at a time from spec
- Each sprint implements app with: React, Vite, FastAPI, SQLite (or PostgreSQL)
- Self-evaluates work at end of each sprint before handing to QA
- Uses git for version control
- Negotiates **sprint contracts** with evaluator BEFORE coding: agreement on what "done" means

**Why sprints:** Scope management. Prevents the agent from drifting as it works longer.

#### Evaluator Agent (QA)

- Uses Playwright MCP to click through running application like a user would
- Tests UI features, API endpoints, database states
- Grades each sprint against:
  - Bugs found during testing
  - Set of grading criteria (product depth, functionality, visual design, code quality)
- Hard thresholds: if any criterion falls below threshold, sprint fails
- Provides detailed feedback on what went wrong

### Four Full-Stack Grading Criteria

1. **Product Depth:** Feature completeness and richness
2. **Functionality:** Does the app actually work? Can users complete intended tasks?
3. **Visual Design:** Polish, consistency, usability of UI
4. **Code Quality:** Architecture, maintainability, absence of technical debt

### Sprint Contract Pattern

**Before each sprint:**
- Generator proposes what it will build and how success will be verified
- Evaluator reviews to ensure generator is building the right thing
- Two iterate until agreement

**Communication via files:** One agent writes a file, next agent reads and responds. This bridges high-level spec with testable implementation without over-specifying implementation.

---

## Context Reset vs. Compaction (Model Perspective)

### Context Anxiety Problem

- **Sonnet 4.5:** Exhibited strong context anxiety, needed resets
- **Opus 4.5:** Largely removed this behavior, could run continuously with compaction

### Implications for Harness Design

Older models needed explicit context resets between agents to avoid premature task wrap-up. Newer models handle long-running tasks in a single continuous session with automatic compaction, reducing orchestration complexity and latency.

**Cost-benefit tradeoff:** Context resets provide clean slate but add token overhead and latency. Modern models may not need the clean slate as much.

---

## Performance Progression: From Baseline to Optimized

### Case Study 1: Retro Video Game Maker

**Prompt:** "Create a 2D retro game maker with features including a level editor, sprite editor, entity behaviors, and a playable test mode."

| Harness Type | Duration | Cost |
|---|---|---|
| Solo Agent | 20 min | $9 |
| Full 3-Agent (with sprints) | 6 hr | $200 |

**Quality difference:** Solo run had broken game mechanics (entities didn't respond to input). Full harness delivered working game with sprite animation system, behavior templates, sound/music, AI-assisted sprite generator, game export.

**Cost factor:** 20x more expensive but vastly superior quality.

### Case Study 2: Digital Audio Workstation (DAW)

**Prompt:** "Build a fully featured DAW in the browser using the Web Audio API."

**Updated harness** (without sprint decomposition, optimized for Opus 4.6):

| Agent & Phase | Duration | Cost |
|---|---|---|
| Planner | 4.7 min | $0.46 |
| Build (Round 1) | 2 hr 7 min | $71.08 |
| QA (Round 1) | 8.8 min | $3.24 |
| Build (Round 2) | 1 hr 2 min | $36.89 |
| QA (Round 2) | 6.8 min | $3.09 |
| Build (Round 3) | 10.9 min | $5.88 |
| QA (Round 3) | 9.6 min | $4.06 |
| **Total** | **~3 hr 50 min** | **$124.70** |

**Generator coherence:** Ran for 2+ hours without sprint decomposition that Opus 4.5 needed.

**QA feedback examples:**
- Identified 27+ testable criteria in one sprint alone
- Found: timeline clips couldn't be dragged/moved
- Found: instrument UI panels were display-only
- Found: audio recording was stub-only (button didn't capture mic)

**Insight:** Even with improved models, QA still catches meaningful gaps and provides real value.

---

## Harness Iteration: Simplification as Models Improve

### Key Principle

Every component in a harness encodes an assumption about what the model can't do on its own. Those assumptions are worth stress testing because:
1. They may be incorrect
2. They go stale as models improve

### Evolution From Opus 4.5 → 4.6

Removed **sprint decomposition** because:
- Opus 4.6 could handle longer coherent tasks natively
- Improved long-context retrieval
- Better code review and debugging capabilities
- Better planning

**Kept:** Planner and Evaluator (each added obvious value)

**Result:** Same quality output, faster execution, lower cost (though still real cost for QA runs).

### Load-Bearing Analysis

The evaluator is **not a fixed yes-or-no decision**. It's worth the cost when the task sits beyond what the current model does reliably solo. As models improve, the boundary of "what model can do solo" expands.

---

## Key Design Insights

1. **GAN-inspired separation:** Generator and evaluator serve the structural role of code review and QA in software development
2. **Grading criteria steer output:** Prompting language (e.g., "museum quality") shapes character of output before evaluator feedback
3. **Sprint-based decomposition:** Managing scope by working feature-at-a-time prevents drift
4. **Sprint contracts bridge specs to code:** Negotiated agreement on testable success prevents over-specification while staying faithful to spec
5. **File-based handoff:** Communication via files keeps orchestration clean and state durable
6. **Continuous iteration:** As models improve, re-examine harnesses and strip away non-load-bearing components

---

## Lessons for AI Engineers

- Experiment with the model you're building against; read its traces on realistic problems
- Decomposing tasks and applying specialized agents to each aspect can yield significant improvements
- When a new model lands, re-examine your harness—strip away pieces no longer load-bearing, add new pieces for greater capability
- The space of interesting harness combinations doesn't shrink as models improve; it moves

