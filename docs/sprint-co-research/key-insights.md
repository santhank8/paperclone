# Key Insights: Anthropic Harness Design for Long-Running Agents

## Three-Agent Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Prompt                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │   PLANNER AGENT            │
            │  (Spec Generation)         │
            │  Input: 1-4 sentence       │
            │  Output: full product spec │
            │  - ambitious scope         │
            │  - high-level design       │
            │  - weaved AI features      │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌─────────────────────────────┐
            │   GENERATOR AGENT           │
            │  (Incremental Building)     │
            │  - Sprint-based work        │
            │  - Feature at a time        │
            │  - React/Vite/FastAPI/SQL  │
            │  - Sprint contracts (with   │
            │    evaluator before build)  │
            │  - Git version control      │
            │  - Self-evaluate per sprint │
            └────────┬────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
      Git Push              Sprint Artifacts
         │                        │
         └───────────┬────────────┘
                     │
                     ▼
            ┌─────────────────────────────┐
            │   EVALUATOR AGENT (QA)      │
            │  (Verification & Grading)   │
            │  - Playwright testing       │
            │  - UI/API/DB state checks   │
            │  - Grades vs criteria       │
            │  - Hard thresholds          │
            │  - Detailed feedback        │
            └────────┬────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
      PASS              FEEDBACK  │
         │                        │
         ▼                        ▼
    Delivered               Generator Iterates
```

---

## Context Management Strategy

### The Problem: Long-Running Task Coherence

Two related issues plague naive long-running agents:
1. **Context window saturation:** Models lose coherence as the context fills
2. **Context anxiety:** Models begin wrapping up work prematurely as they perceive approaching context limits

### Two Approaches to Solve It

#### 1. Context Reset (Older Models)

**Strategy:** Clear the context window entirely and start a fresh agent with structured handoff.

- **Advantage:** Provides a clean slate; eliminates context anxiety entirely
- **Disadvantage:** Adds orchestration complexity, token overhead, and latency
- **When to use:** Models like Sonnet 4.5 that exhibit context anxiety strongly

**Implementation:**
- Previous agent writes summary + next steps to artifact
- New agent reads artifact and continues work
- Clean context = no anxiety-driven premature conclusion

#### 2. Context Compaction (Newer Models)

**Strategy:** Summarize earlier parts of conversation in place; agent continues on shortened history in same session.

- **Advantage:** Preserves continuity, simpler orchestration
- **Disadvantage:** Agent may still exhibit context anxiety even with compaction
- **When to use:** Models like Opus 4.5 that don't have strong context anxiety

**Finding:** Claude Opus 4.5+ largely removes context anxiety behavior, enabling full runs in single continuous session with automatic compaction.

### Model-Specific Context Behavior

| Model | Context Anxiety | Solution | Architecture |
|---|---|---|---|
| Sonnet 4.5 | Strong | Context resets needed | Multi-session with handoff artifacts |
| Opus 4.5 | Minimal | Compaction sufficient | Single continuous session |
| Opus 4.6 | Minimal | Compaction sufficient | Single continuous session (even stronger) |

**Implication:** As models improve, harness design can simplify—less need for reset orchestration overhead.

---

## GAN-Inspired Generator/Evaluator Pattern

### The Insight

Adapted architecture from Generative Adversarial Networks (GANs) to address the **self-evaluation bias problem**: agents confidently praise their own work even when quality is mediocre.

### The Pattern

**Generator:** Creates outputs (designs, code, features)

**Evaluator:** Grades outputs against explicit criteria

**Why it works:**
- Generator focuses on creation; evaluator focuses on judgment
- Separating concerns allows independent tuning of each
- Evaluator can be made skeptical without hobbling generator
- Feedback loop: generator sees external critique and iterates

### Self-Evaluation Bias Problem

When agents evaluate their own work:
- They tend to be overly generous, especially on subjective tasks (design)
- Even on verifiable tasks, they exhibit poor judgment while completing work
- They lack external perspective to recognize mediocre outputs

**Solution:** External evaluator provides objective feedback loop.

---

## Design Grading Criteria (Subjective Task: Frontend)

When teaching evaluator to judge design quality, four concrete criteria were developed:

### 1. Design Quality
**Question:** Does the design feel like a coherent whole rather than a collection of parts?

**What this means:**
- Colors, typography, layout, imagery combine intentionally
- Creates distinct mood and identity
- Not just functional, but aesthetically cohesive

**Why it matters:** Claude defaults to safe, predictable, unremarkable layouts. This criterion pushes toward distinctiveness.

### 2. Originality
**Question:** Is there evidence of custom decisions, or is this template layouts and library defaults?

**What this means:**
- Human designer should recognize deliberate creative choices
- Unmodified stock components fail here
- Telltale AI-generation patterns (purple gradients, generic cards) fail here

**Why it matters:** Prevents AI slop. Rewards genuine customization.

### 3. Craft
**Question:** Technical execution—typography hierarchy, spacing, color harmony, contrast ratios?

**What this means:**
- Competence check: fundamentals of design
- Most reasonable implementations pass by default
- Only fails on broken basics

**Why it matters:** Quality gate for the "can it work?" dimension.

### 4. Functionality
**Question:** Usability independent of aesthetics—can users complete their tasks?

**What this means:**
- UI is navigable and understandable
- Primary actions are discoverable
- No confusion about what to do

**Why it matters:** Beautiful-but-broken is worthless.

### Weighting Strategy

**Emphasis:** Design quality and originality were weighted more heavily.

**Reason:** Craft and functionality come naturally to Claude. The weak points are aesthetic coherence and avoiding generic patterns. By emphasizing design and originality, you push the model away from its safe defaults toward more distinctive work.

### The "Museum Quality" Steering Insight

**Observation:** Including phrases like **"the best designs are museum quality"** in the grading criteria pushed designs toward a particular visual convergence.

**Implication:** The *language* of the grading criteria, not just the logic, shapes the character of output. Prompting steers the model's generation before evaluator feedback even enters.

---

## Full-Stack Grading Criteria (Verifiable Task: Coding)

For coding tasks, four criteria map to software development dimensions:

### 1. Product Depth
**What counts:** Feature completeness and richness. Does the app deliver what the spec promises?

### 2. Functionality
**What counts:** Does the app actually work? Can users complete intended tasks without bugs?

### 3. Visual Design
**What counts:** Polish, consistency, usability of UI. Does it look and feel professional?

### 4. Code Quality
**What counts:** Architecture, maintainability, absence of technical debt. Can future developers understand and extend it?

### Hard Thresholds

Each criterion has a **hard threshold**. If ANY criterion falls below threshold, the sprint FAILS and generator gets detailed feedback.

**Why hard thresholds:** Prevents evaluator from rubber-stamping mediocre work. Forces generator to address failures, not just improvements.

---

## Sprint Contract Pattern: Bridge Between Spec and Code

### The Problem

- **Product spec is high-level:** Avoids over-specifying implementation details
- **But this creates ambiguity:** What does "done" mean for each feature?
- **Without clarity:** Generator and evaluator may have different expectations

### The Solution: Sprint Contracts

**Before each sprint (before any code is written):**
1. **Generator proposes:** What will I build? How will success be verified?
2. **Evaluator reviews:** Is this the right thing? Is success testable?
3. **Both iterate:** Until they agree on contract
4. **Generator builds:** Against the agreed contract
5. **Evaluator tests:** Against the agreed contract criteria

### Example: Game Maker Sprite Editor

**Contract for Sprint 3 (Sprite Editor)** had 27 concrete testable criteria:
- "User can select and delete placed entity spawn points"
- "Rectangle fill tool allows click-drag to fill rectangular area"
- "Animation frames can be reordered via API"

**Why this works:**
- Spec stays high-level ("sprite editor with tools")
- Contract bridges to testable implementation ("user can drag to select, delete key removes selection")
- Generator has clear target; evaluator has clear test cases

### Communication via Files

Contracts are exchanged via files:
- Generator writes proposal file
- Evaluator reads and responds (or writes counter-proposal)
- Artifacts are durable across context resets
- Keeps orchestration clean

---

## Context Anxiety: Model-Specific Behavior

### What Is Context Anxiety?

Behavior where model begins wrapping up work prematurely as it perceives approaching context limits.

- Model infers a context limit and starts summarizing/concluding
- Happens even with abundant context remaining
- Results in incomplete work, premature termination
- Makes compaction-only approaches insufficient

### Sonnet 4.5 vs. Opus 4.5+

**Sonnet 4.5:**
- Exhibited context anxiety **strongly**
- Compaction alone was insufficient
- Required explicit **context resets** (clear context, fresh agent, handoff artifacts)
- Added orchestration complexity and latency

**Opus 4.5 / 4.6:**
- Largely **eliminated** context anxiety
- Can run long tasks in **single continuous session**
- Automatic compaction handles context growth
- Simpler harness design

### Implication for Sprint Company

Use the strongest available model (Opus 4.6 or later if available). Weaker models require more harness scaffolding (resets, explicit decomposition).

---

## Sprint-Based Decomposition vs. One-Shot Generation

### One-Shot Generation (Baseline)

**Prompt:** "Build a DAW"  
**Approach:** Single agent, no decomposition  
**Duration:** ~20 minutes  
**Cost:** ~$9  
**Result:** Broken functionality, shallow feature implementation

### Sprint-Based Generation (Harness)

**Approach:** Plan → Feature at a time → Test → Iterate  
**Duration:** ~6 hours  
**Cost:** ~$200  
**Result:** Full-featured working app, all core primitives functional

### Key Benefits of Sprint Decomposition

1. **Scope management:** Feature-by-feature prevents drift
2. **Testability:** Smaller chunks allow concrete testing via evaluator
3. **Iterability:** Feedback loop per sprint drives quality up
4. **Clarity:** Sprint contracts specify exactly what "done" means

### When to Use

**Opus 4.6 finding:** Could remove sprint decomposition (model stayed coherent for 2+ hours), but kept planning and evaluation.

**Trade-off:**
- Without sprints: faster, cheaper, but riskier
- With sprints: slower, costlier, but higher quality assurance

**Current best practice:**
- Use **planning** (always valuable for scope)
- Use **evaluation** (worth cost for complex tasks)
- Use **sprints** (optional with newer models, depends on task complexity)

---

## Harness Evolution: Simplifying as Models Improve

### Core Principle

Every harness component encodes an assumption: "The model can't do X reliably." As models improve, those assumptions go stale and should be revisited.

### From Opus 4.5 to 4.6

**What was removed:** Sprint decomposition
- Reason: Model got strong enough to handle 2+ hour coherent builds
- Result: Same output quality, faster execution, lower cost
- Tradeoff: Added more complex prompting for agent integration

**What was kept:** Planner and Evaluator
- Reason: Each continued to add obvious, measurable value
- Planner prevents under-scoping; evaluator catches real bugs

### Lesson

When a new model releases:
1. **Stress test your harness:** Remove components one at a time
2. **Measure impact:** Track quality degradation
3. **Keep load-bearing:** Only keep what adds value
4. **Opportunistically add:** Can you now attempt harder tasks?

### Evaluator Cost-Benefit

**Question:** Is evaluation worth the cost for this task?

**Answer:** Yes, when task sits beyond what the current model does reliably solo.

**Boundary shifts:** As models improve, more tasks move into "model does fine solo" territory. But harness space doesn't shrink—harder tasks move into evaluator territory.

---

## Practical Handoff Artifacts

### What Works

**File-based handoff:**
- Generator writes commit to repo + artifact file
- Evaluator reads artifact + tests running app
- Feedback written to file or new message
- Generator reads feedback and iterates

**Why files:**
- Durable across context resets
- Keeps state external to model
- Clear contract between agents
- Works with tool-use (file operations)

### State Carried in Handoff

- Current app state (git repo)
- Sprint contract + test results
- Feedback + bug list
- Next steps or priority

---

## Summary: Architecture for Sprint Company

The **three-agent pattern** (Planner → Generator → Evaluator) provides:

1. **Planner:** Prevents under-scoping; expands raw requirements into testable spec
2. **Generator:** Builds iteratively with sprint focus; negotiates testable contracts
3. **Evaluator:** Verifies quality against criteria; provides actionable feedback

**Key differentiators:**
- GAN-inspired separation prevents self-evaluation bias
- Grading criteria (both design and functional) steer output quality
- Sprint contracts bridge high-level spec to low-level implementation
- Context management strategy (compaction for modern models) allows long-running sessions

**Cost-quality tradeoff:** Full harness is 20x more expensive but produces vastly superior results (working features, polished UI, bug-free core).

