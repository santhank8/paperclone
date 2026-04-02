# Market Intelligence Framework

> Scout's competitive analysis and trend monitoring system.

**Owner:** Scout
**Updated:** Monthly (intel summary) + real-time (urgent signals)
**Status:** Active

---

## Monitoring Targets

### Primary Competitors

| Category | Targets | Why We Watch |
|----------|---------|-------------|
| **AI Code Generators** | GitHub Copilot, Cursor, Codeium, Tabnine, Amazon CodeWhisperer | Direct feature overlap — they generate code, we orchestrate agents that generate code |
| **Autonomous Agent Frameworks** | AutoGPT, CrewAI, LangGraph, OpenAI Agents SDK, Anthropic Claude Code | Architectural peers — they solve multi-agent coordination like we do |
| **Sprint/Project Tools** | Linear, Jira, Shortcut, Plane | Workflow overlap — they manage sprints, we automate them |
| **AI Dev Platforms** | Replit Agent, Devin, Factory, Poolside | Full-stack competitors — they aim to automate the same software development loop |

### Adjacent Markets
- No-code/low-code platforms (Bubble, Retool)
- DevOps automation (Spacelift, Env0)
- AI testing tools (Codium, Qodo)

---

## Signal Sources

| Source | What We Look For | Check Frequency |
|--------|-----------------|-----------------|
| **GitHub Trending** | New repos in agent/AI-dev categories, star velocity on competitors | Weekly |
| **Hacker News** | Front-page posts about AI coding tools, sentiment in comments | Daily |
| **Product Hunt** | New launches in developer tools, AI agents categories | Weekly |
| **arXiv AI Papers** | Papers on multi-agent systems, code generation, agent coordination | Bi-weekly |
| **Model Release Announcements** | New models from OpenAI, Anthropic, Google, Meta, Mistral | As they happen |
| **Twitter/X Developer Community** | Viral threads about AI dev tools, pain points with current tools | Daily |
| **Conference Talks** | AI engineering conferences, demos of competing tools | As scheduled |

---

## Analysis Framework

For each significant competitor or emerging tool, Scout produces a structured analysis:

```markdown
## Competitor Analysis: [Name]

**Last updated:** YYYY-MM-DD
**Analyst:** Scout

### What They Do
[One-paragraph summary of the product/tool]

### How They Compare to Sprint Co
| Dimension | Them | Sprint Co | Advantage |
|-----------|------|-----------|-----------|
| Agent orchestration | [desc] | [desc] | [Them/Us/Neutral] |
| Budget management | [desc] | [desc] | [Them/Us/Neutral] |
| Quality governance | [desc] | [desc] | [Them/Us/Neutral] |
| Developer experience | [desc] | [desc] | [Them/Us/Neutral] |
| Autonomy level | [desc] | [desc] | [Them/Us/Neutral] |

### What We Can Learn
[Specific tactics, features, or approaches worth studying or adopting]

### Threat Level
- [ ] **HIGH** — Direct competitor with superior execution in our core area
- [ ] **MEDIUM** — Overlapping features but different target market or approach
- [ ] **LOW** — Tangentially related, worth watching but not urgent
- [ ] **NONE** — Different market, no meaningful overlap

### Opportunity
[How this competitor's existence or approach creates opportunities for Sprint Co]
```

---

## Monthly Intel Summary Template

```markdown
## Market Intelligence Summary — [Month YYYY]

**Prepared by:** Scout
**Sprint range:** S-NNN to S-NNN

### Key Developments
1. [Most important thing that happened]
2. [Second most important]
3. [Third most important]

### Competitor Movements
| Competitor | What Changed | Impact on Sprint Co |
|-----------|-------------|-------------------|
| [name] | [change] | [impact] |

### New Entrants
| Name | What They Do | Threat Level | Notes |
|------|-------------|-------------|-------|
| [name] | [desc] | [level] | [notes] |

### Model/Infrastructure Changes
| Change | Provider | Implication for Sprint Co |
|--------|---------|--------------------------|
| [change] | [provider] | [implication] |

### Trend Shifts
[Any notable shifts in market direction, developer sentiment, or technology adoption]

### Recommended Actions
| Action | Priority | Rationale |
|--------|----------|-----------|
| [action] | [H/M/L] | [why] |

### Next Month's Watch List
[Specific things to monitor in the coming month]
```

---

## Strategic Implications

How market signals should influence Sprint Co's roadmap:

### Signal → Response Matrix

| Signal Type | Example | Response |
|-------------|---------|----------|
| **Competitor ships feature we lack** | Devin adds budget tracking | Stakeholder evaluates user demand → prioritize if wanted |
| **New model release** | Claude 4 with better agentic capabilities | Delivery evaluates integration → Scout assesses advantage |
| **Market trend toward X** | Everyone adopting MCP protocol | Sprint Lead assesses adoption cost → Board decides |
| **Competitor failure/shutdown** | Competing tool goes offline | Scout evaluates their user base → opportunity to capture |
| **Viral criticism of AI tools** | "AI code is unreliable" HN thread | Critic reviews our quality gates → Stakeholder addresses in messaging |
| **New regulation** | EU AI Act enforcement begins | Judge reviews compliance → Board adjusts roadmap |

### Integration with Prioritization

Market intelligence feeds into the [Feature Prioritization Framework](feature-prioritization.md):
- Competitive pressure can increase a feature's **Reach** score (more users care now)
- Market validation can increase **Confidence** score (market proves demand)
- Competitive threat can increase **Alignment** score (mission-critical to keep up)

---

## Trend Tracking

| Trend | First Observed | Current Direction | Sprint Co Relevance | Action Taken |
|-------|---------------|-------------------|--------------------:|-------------|
| Multi-agent orchestration becoming mainstream | S-005 | Accelerating | **HIGH** | Core to our product — maintain lead |
| Shift from code completion to full code generation | S-008 | Steady | **HIGH** | Our agents do full generation — aligned |
| Developer skepticism of "AI replaces devs" | S-010 | Growing | **MED** | Position as "AI augments teams," not replaces |
| On-device / local-first AI movement | S-012 | Emerging | **MED** | Evaluate local adapter support |
| AI agent cost sensitivity | S-015 | Growing | **HIGH** | Budget management is a differentiator |
| Regulatory attention on AI-generated code | S-018 | Emerging | **LOW** (for now) | Monitor, prepare compliance docs |

### Trend Review Cadence
- Scout reviews and updates the trend table every 5 sprints
- Major trend shifts trigger an ad-hoc Board briefing
- Trends marked **HIGH** relevance are included in every sprint planning discussion
