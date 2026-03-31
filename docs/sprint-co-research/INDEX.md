# Sprint Co Paperclip Company Setup — Source Materials Index

**Last Updated:** 2026-03-31  
**Source Base:** `/Volumes/JS-DEV/paperclip-setup/source-materials/`  
**Total Files:** 19 files across 3 directories

---

## Overview

This collection contains all reference materials, research findings, and technical documentation needed to design and implement the **Sprint Co Paperclip company**—an autonomous 3-hour software development sprint powered by multi-agent orchestration (Planner, Generator, Evaluator).

The materials are organized in three sections:
1. **Core References** — Top-level synthesis and insights
2. **Paperclip Documentation** — Local copies of Paperclip framework docs
3. **GitHub Fetches** — Agent developer guides from GitHub

---

## Core References (5 files at root)

### 1. `anthropic-harness-blueprint.md`
**Purpose:** Complete overview of Anthropic's three-agent harness design  
**Source:** https://www.anthropic.com/engineering/harness-design-long-running-apps (fetched and cleaned)  
**Contains:**
- Why naive implementations fail (context coherence, self-evaluation bias)
- Frontend design grading criteria (4 design metrics)
- Full-stack grading criteria (4 software metrics)
- GAN-inspired generator/evaluator separation
- Three-agent architecture (Planner → Generator → Evaluator)
- Sprint contract pattern and negotiation flow
- Context management (reset vs. compaction for different models)
- Real case studies (retro game maker: solo $9/20min vs. harness $200/6hr)
- DAW (Digital Audio Workstation) results with Opus 4.6

**Key Insight:** 20x more expensive, vastly superior quality. Generator + Evaluator + Planner = museum-quality outputs.

### 2. `key-insights.md`
**Purpose:** Curated extraction of the most actionable learnings from the blueprint  
**Contains:**
- ASCII diagram of three-agent architecture
- Context anxiety explanation (why Sonnet 4.5 needs resets, Opus 4.5+ doesn't)
- GAN pattern motivation and benefits
- Design grading criteria with weighting strategy
- Full-stack grading criteria for coding tasks
- Sprint contract pattern details
- Model-specific context behavior table
- Sprint decomposition vs. one-shot generation comparison
- Harness evolution principles (simplify as models improve)

**Use When:** You need the condensed version without 13K words of Anthropic's full article.

### 3. `research-notes.md`
**Purpose:** Web research synthesis on long-running agents, Paperclip ecosystem, and AI-augmented Scrum  
**Sources:**
- Anthropic blogs (Nov 2025, March 2026)
- Paperclip ecosystem (paperclipai, Clipmart marketplace)
- Scrum.org AI-augmented frameworks (March 2026)
- AgentScrum.ai and related tools

**Contains:**
- Three separate search syntheses
- Clipmart positioning: "Companies, not agents" (org charts, budgets, governance)
- AI Scrum insights: sprint planning breaks with autonomous agents, contract-based alternative
- Key question framework for Sprint Co implementation

**Key Finding:** Sprint Co must be designed as a coherent business unit, not a collection of agents. The planner/generator/evaluator pattern effectively replaces traditional Scrum events.

### 4. `flash-moe-notes.md`
**Purpose:** Assessment of Flash-MoE (397B Qwen model on MacBook) for Sprint Co use  
**Contains:**
- What Flash-MoE is (C/Metal inference engine, 4.36 tok/s on M3 Max)
- Feasibility analysis (Low for production, Medium for research)
- Cost-speed-quality comparison table
- Integration constraints (hardware availability, cloud deployment, API compatibility)
- Why we're switching to Opus 4.6 (scalability, parallel agents, API-first)
- Haiku as budget alternative (4x cheaper, 30% quality drop)
- Recommended use cases for Flash-MoE (offline testing, prompt optimization)

**Recommendation:** Use Opus 4.6 for production (best coherence + quality), Flash-MoE for research/offline eval only.

### 5. `anthropic-harness-blueprint.md`
**[Already listed above - comprehensive Anthropic article in clean markdown]**

---

## Paperclip Documentation (8 files in `paperclip-docs/`)

**Source:** Local copies from `/Volumes/JS-DEV/paperclip/` (existing local installation)

### Agent Developer Guides

#### `how-agents-work.md`
- Agent lifecycle and execution model
- Trigger, adapter, runtime, API calls, result capture
- Agent identity and environment variables
- Session persistence across heartbeats
- Agent status states (active, idle, running, error, paused, terminated)

#### `task-workflow.md`
- Checkout pattern (atomic locking for task ownership)
- Work-and-update pattern (commenting on in-progress work)
- Blocked pattern (escalation when stuck)
- Delegation pattern (manager breaking work into subtasks)
- Release pattern (giving up task ownership)
- Worked example: IC heartbeat walkthrough

#### `heartbeat-protocol.md`
- 9-step heartbeat procedure
- Step 1: Identity check
- Step 2: Approval follow-up
- Step 3: Get assignments
- Step 4: Pick work (priority ordering)
- Step 5: Checkout task
- Step 6: Understand context
- Step 7: Do work
- Step 8: Update status
- Step 9: Delegate if needed
- Critical rules (always checkout, never retry 409, always comment, set parentId)

#### `writing-a-skill.md`
- Skill structure and SKILL.md format
- Frontmatter fields (name, description)
- Runtime skill loading and routing logic
- Best practices (routing as decision logic, specific/actionable, code examples)
- Skill injection and adapter responsibility

#### `handling-approvals.md`
- Requesting a hire (manager/CEO action)
- CEO strategy approval
- Responding to approval resolutions (how to handle approved/rejected)
- Checking approval status

#### `companies-spec.md`
- Full Agent Companies specification (vendor-neutral)
- Package kinds (COMPANY.md, TEAM.md, AGENTS.md, PROJECT.md, TASK.md, SKILL.md)
- Core principles (Markdown-first, Git-native, no central registry)
- Detailed examples and field specifications
- Skill resolution by shortname
- Source references and provenance tracking
- Import graph and UI behavior guidance
- Vendor extensions (.paperclip.yaml for Paperclip-specific config)
- Export rules and licensing/attribution preservation

#### `paperclip-skill.md`
- Core Paperclip framework skill documentation
- How Paperclip agents discover and use skills
- Skill loading and routing in the context of the Paperclip runtime

#### `cost-reporting.md` & `comments-and-communication.md`
- Cost tracking and reporting mechanisms
- Comment and communication patterns for agent-to-agent or agent-to-human interaction

---

## GitHub Fetches (6 files in `paperclip-github/`)

**Source:** https://raw.githubusercontent.com/paperclipai/paperclip/master/ (with SHA pinning recommended)

### Developer Guides (duplicates of paperclip-docs with GitHub source)

#### `how-agents-work.md` (GitHub version)
#### `task-workflow.md` (GitHub version)
#### `heartbeat-protocol.md` (GitHub version)
#### `writing-a-skill.md` (GitHub version)
#### `handling-approvals.md` (GitHub version)

**Note:** These mirror the local paperclip-docs versions. GitHub versions kept for reference/pinning to immutable commit SHA.

#### `companies-spec.md` (GitHub version)
- Full specification document for Agent Companies format
- Comprehensive reference for package structure and semantics

**Note:** .claude/skills/paperclip/SKILL.md fetch returned 404 — file not found at that GitHub path. May need to verify correct location or GitHub branch.

---

## Directory Structure

```
/Volumes/JS-DEV/paperclip-setup/source-materials/
├── INDEX.md                              # This file
├── anthropic-harness-blueprint.md        # Anthropic article (13.8KB)
├── key-insights.md                       # Curated synthesis (14.7KB)
├── research-notes.md                     # Web research findings (7.2KB)
├── flash-moe-notes.md                    # Flash-MoE assessment (6.7KB)
│
├── paperclip-docs/                       # Local Paperclip installation docs
│   ├── companies-spec.md
│   ├── comments-and-communication.md
│   ├── cost-reporting.md
│   ├── handling-approvals.md
│   ├── heartbeat-protocol.md
│   ├── how-agents-work.md
│   ├── paperclip-skill.md
│   ├── task-workflow.md
│   ├── writing-a-skill.md
│   └── agent-developer/                  # Guides subdirectory (if present)
│
└── paperclip-github/                     # GitHub fetches (backup/reference)
    ├── companies-spec.md
    ├── handling-approvals.md
    ├── heartbeat-protocol.md
    ├── how-agents-work.md
    ├── task-workflow.md
    └── writing-a-skill.md
```

---

## How to Use These Materials

### For Architecture Design
1. **Start:** Read `key-insights.md` (30 min) for condensed overview
2. **Deep dive:** Read `anthropic-harness-blueprint.md` (45 min) for full context
3. **Verify:** Check `research-notes.md` to see how this aligns with broader AI/Scrum trends

### For Paperclip Integration
1. **Understand heartbeat:** Read `paperclip-docs/how-agents-work.md` + `heartbeat-protocol.md`
2. **Learn task patterns:** Read `paperclip-docs/task-workflow.md`
3. **Write skills:** Read `paperclip-docs/writing-a-skill.md`
4. **Handle approvals:** Read `paperclip-docs/handling-approvals.md`

### For Package Definition
1. **Reference:** Use `paperclip-docs/companies-spec.md` (or GitHub version)
2. **Structure:** Define COMPANY.md, AGENTS.md, PROJECT.md, TASK.md, SKILL.md files
3. **Extensions:** Add `.paperclip.yaml` for Paperclip-specific runtime config

### For Cost/Model Selection
1. **Read:** `flash-moe-notes.md` for analysis of local vs. cloud models
2. **Recommendation:** Opus 4.6 for production (quality + coherence)
3. **Alternative:** Haiku for budget-constrained MVP (4x cheaper, 30% quality drop)

### For Implementation Checklist
Use these materials as reference while building:
- [ ] Three-agent harness skeleton (planner, generator, evaluator)
- [ ] Grading criteria for each (design, originality, craft, functionality)
- [ ] Sprint contract negotiation pattern
- [ ] Paperclip heartbeat loop integration
- [ ] Skills for common tasks (code review, testing, design critique)
- [ ] Cost tracking and reporting
- [ ] Approval flow for hiring/strategy changes

---

## Files Created by This Task

**Root level (5 files):**
- ✅ anthropic-harness-blueprint.md (13,800 bytes)
- ✅ key-insights.md (14,748 bytes)
- ✅ research-notes.md (7,166 bytes)
- ✅ flash-moe-notes.md (6,727 bytes)
- ✅ INDEX.md (this file)

**paperclip-docs/ (inherited from local installation, 9 files)**
- companies-spec.md
- comments-and-communication.md
- cost-reporting.md
- handling-approvals.md
- heartbeat-protocol.md
- how-agents-work.md
- paperclip-skill.md
- task-workflow.md
- writing-a-skill.md
- agent-developer/ (subdirectory with guides)

**paperclip-github/ (fetched from GitHub, 6 files)**
- ✅ companies-spec.md (17,628 bytes)
- ✅ handling-approvals.md (1,700 bytes)
- ✅ heartbeat-protocol.md (2,762 bytes)
- ✅ how-agents-work.md (2,325 bytes)
- ✅ task-workflow.md (2,648 bytes)
- ✅ writing-a-skill.md (2,162 bytes)

**Total created by this subagent:** ~50KB of new materials + ~62KB of GitHub fetches

---

## Notes & Caveats

1. **GitHub SKILL.md (404):** The path `.claude/skills/paperclip/SKILL.md` returned 404. This may be located elsewhere in the Paperclip repo. Consider checking the correct path or using the local copy from `paperclip-docs/paperclip-skill.md` instead.

2. **Anthropic article fetched March 31, 2026:** Article content reflects Anthropic's latest thinking on harness design. Timestamps in case studies (game maker, DAW) are from March 2026.

3. **Paperclip spec version:** `agentcompanies/v1-draft` — This is a draft specification. Production use should verify latest version.

4. **Flash-MoE context:** Flash-MoE (397B Qwen model) exists locally but is research-grade. Recommendation: use Opus 4.6 for production Sprint Co.

5. **All external content wrapped:** Web-fetched materials are marked as `EXTERNAL_UNTRUSTED_CONTENT` per OpenClaw security policy. Content has been extracted and cleaned into markdown format.

---

## Next Steps for Sprint Co Team

1. **Review materials** — Read `key-insights.md` and `research-notes.md` (1 hour)
2. **Design harness** — Define planner, generator, evaluator prompts using grading criteria from `anthropic-harness-blueprint.md`
3. **Create package** — Use `companies-spec.md` to structure COMPANY.md, AGENTS.md, etc.
4. **Integrate Paperclip** — Implement heartbeat loop using `heartbeat-protocol.md` and `task-workflow.md`
5. **Test Sprint 1** — Run a 3-hour sprint on a small product (e.g., "Todo app with Claude integration")
6. **Cost tracking** — Use `cost-reporting.md` guidelines to track and optimize per-sprint costs
7. **Iterate harness** — Remove non-load-bearing components as model capabilities improve (see harness evolution in `key-insights.md`)

---

## Acknowledgments

Materials compiled from:
- **Anthropic Labs:** Prithvi Rajasekaran and team (harness design, frontend design skill)
- **Paperclip AI:** Open-source orchestration framework and specification
- **Community Research:** Scrum.org, AI-augmented frameworks, agent development best practices
- **Local development:** Flash-MoE team (inference optimization research)

---

**Generated:** 2026-03-31 18:15 PDT  
**For:** Sprint Co Paperclip Company Setup  
**Status:** Complete — All 5 tasks finished, 19 files created/organized
