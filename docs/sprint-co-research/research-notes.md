# Research Notes: Sprint Co Paperclip Company Setup

## Search 1: Anthropic Claude Code Agent Harness Long-Running 3-Hour Sprint

**Key Findings:**

1. **Anthropic Engineering Blog (Nov 2025):** "Effective Harnesses for Long-Running Agents"
   - Agents face challenges working across many context windows
   - Inspiration from human engineer workflows for better harness design
   - Focus on tasks spanning hours or even days

2. **ZenML Case Study:**
   - Multi-context window capability research via Claude Agent SDK
   - Enabling long-running AI agents for complex software projects
   - Significant contribution to operationalizing LLMs for sustained, autonomous development

3. **LinkedIn: "How to Build AI Agents That Work While You Sleep"**
   - Key insight: Difference between 1-hour stalling agents and 24+ hour production agents = effective harness architecture
   - Anthropic has developed proven patterns for multi-hour runs

4. **GitHub: eddiearc/long-running-harness**
   - Claude Code skill for maintaining continuity across multiple context windows
   - Directly based on Anthropic's research on effective harnesses

5. **Marvin-42 Analysis (March 24, 2026):**
   - Multi-agent harness for frontend design and long-running autonomous software engineering
   - Separates planning, generation, and evaluation
   - Clear performance gains over simpler solo-agent runs

**Implication:** The 3-hour sprint concept aligns with Anthropic's "effective harnesses" research. Multi-agent separation (planner/generator/evaluator) is the proven pattern for staying coherent across extended sessions.

---

## Search 2: Paperclip AI Agent Company and Clipmart

**Key Findings:**

1. **paperclipai/clipmart (GitHub)**
   - Description: "Buy and sell AI-agent companies"
   - Marketplace for trading fully-configured autonomous companies

2. **Paperclip.ai.net**
   - "The control plane for AI agents"
   - "Manage a team of AI agents to run your business"
   - Features: Org charts, budgets, governance, goals — all in one deployment

3. **Paperclip.ing (Open Source)**
   - "Open-source orchestration for zero-human companies"
   - "Hire AI employees, set goals, automate jobs and your business runs itself"

4. **Paperclip.inc**
   - "The Operating System for AI Agent Companies"
   - Features: Org structure, governance, budgets, chain of command
   - Fully managed solution

5. **Clipmart.it (Marketplace)**
   - "The Marketplace for Agentic Companies"
   - Key differentiator: **Not individual agents, but entire companies**
   - Quote: "The world has plenty of individual AI agents. What it lacks is infrastructure to run them as coherent, goal-aligned business units — with real org charts, real budgets, real accountability."
   - Fully-configured autonomous companies with: roles assigned, missions set, cost controls, audit trails

**Implication:** The Sprint Co company should be designed as a complete, coherent business unit—not just a collection of agents. Clipmart positioning emphasizes the structural/governance layer that Paperclip provides.

---

## Search 3: AI Agent Scrum Sprint and Autonomous Software Development

**Key Findings:**

1. **Scrum.org: "AI Augmented Scrum Framework"**
   - Topic: When half your team is autonomous agents
   - Problem: Autonomous agents "never sleep or burn out, but completely lack business context"
   - Result of naive integration: broken workflows, mismatched velocity, technical debt
   - Solution domain: evolving Scrum events, redefining human accountability, hybrid orchestration

2. **Agile Leadership Day India (March 2026)**
   - "How to Do Sprint Planning for AI Agents"
   - Core insight: Traditional sizing models break when autonomous bots enter
   - Question: Do AI agents use story points in Scrum?
   - Implication: Sprint planning must be fundamentally different for AI-only teams

3. **AgentScrum.ai**
   - "Elevate Agile Delivery with Smart Automation"
   - Features: automated sprint planning, task tracking, retrospectives
   - Goal: boost productivity, collaboration, delivery velocity

**Implication:** A 3-hour sprint for AI agents requires rethinking traditional Scrum. The planner/generator/evaluator pattern effectively replaces the human sprint planning → daily standup → review cycle. The "contract negotiation" before each sprint is the AI equivalent of sprint planning.

---

## Synthesis: Sprint Co Design Direction

### 1. **Harness Pattern (from Anthropic Research)**
- **Planner Agent:** Converts high-level requirements → detailed spec
- **Generator Agent:** Implements features iteratively with sprint focus
- **Evaluator Agent:** Tests and provides feedback loop for quality
- **Result:** 20x more expensive than one-shot, but vastly superior output quality

### 2. **Company Scope (from Paperclip/Clipmart)**
- Design Sprint Co as a coherent business unit, not a bag of agents
- Structure: CEO + roles/team with proper org hierarchy
- Governance: budgets, goals, chain of command
- Sustainability: audit trails, cost controls

### 3. **Sprint Mechanics (from Scrum + AI Research)**
- **Not traditional Scrum:** AI agents don't have story points or velocity
- **Instead: Contract-based sprints:**
  1. Planner sets high-level goal
  2. Generator proposes sprint scope + success criteria
  3. Evaluator reviews and negotiates contract
  4. Generator builds against contract
  5. Evaluator validates and provides feedback
  6. Loop until done
- **3-hour cycle:** Aligns with observed long-running agent coherence limits

### 4. **Technology Stack**
- **Paperclip:** Infrastructure for company structure, heartbeat orchestration, approvals
- **Claude Opus 4.6+:** Best available model for long-running coherence
- **Claude Agent SDK:** For multi-agent coordination and session persistence

### 5. **Cost vs. Quality Tradeoff**
- Solo agent: 20 min, $9, broken features
- Full harness: 6 hours, $200, working app with polish
- Optimization: Remove sprint decomposition for stronger models (Opus 4.6+), keep planner/evaluator

---

## Key Questions for Sprint Co Implementation

1. **What is the unit of work?**
   - Paperclip suggests full-stack "companies" not single features
   - Start with product company, then expand

2. **How does the CEO direct work?**
   - High-level goals → Planner breaks into sprint-sized chunks
   - CEO approves strategic direction before execution

3. **What's the failure mode?**
   - Generator under-scopes or drifts (mitigated by planner)
   - Evaluator rubber-stamps mediocre work (mitigated by grading criteria)
   - Both agents need careful prompting/tuning

4. **How do we measure success?**
   - Output quality: product depth, functionality, design, code quality
   - Time-to-delivery: 3-4 hour target for MVP-scale features
   - Cost efficiency: optimize harness overhead as models improve

---

## References

- **Anthropic Blog:** "Harness Design for Long-Running Application Development" (March 2026)
- **Anthropic Blog:** "Effective Harnesses for Long-Running Agents" (Nov 2025)
- **GitHub:** paperclipai/paperclip, paperclipai/clipmart
- **Web:** Paperclip.inc, Clipmart.it
- **Scrum.org:** "AI Augmented Scrum Framework" (2026)
