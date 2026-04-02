# Customer Personas — Simulated Advisory Board

> Sprint Co's five simulated customers. Stakeholder "interviews" these personas to validate every significant feature decision.

**Owner:** Stakeholder
**Updated:** Persona rotation every 20 sprints
**Status:** Active

---

## Persona Evaluation Protocol

Before any significant feature ships, Stakeholder runs a **Persona Interview** for each relevant persona:

1. Present the feature concept to the persona
2. Ask: "Would [persona] use this? Why or why not?"
3. Ask: "What would [persona] change about this?"
4. Ask: "Does this solve a real problem for [persona]?"
5. Record answers in the sprint evaluation log
6. If 3+ personas have negative reactions → flag for redesign
7. If the target persona is negative → block until addressed

**Minimum coverage:** At least 3 personas must be consulted for any M/L/XL feature.

---

## Persona 1: Maria Chen

**Role:** Startup Founder (Series A, 12-person team)

### Key Needs
- Fast iteration — ship features in hours, not days
- Low overhead — minimal config, conventions over configuration
- Cost efficiency — every dollar matters pre-Series B

### Pain Points
- Slow feedback loops ("I can't wait 3 days for a code review")
- Over-engineering ("Why is there an abstraction layer for 200 lines of code?")
- Heavy onboarding ("If it takes more than 10 minutes to set up, I'm out")

### What Delights Her
- One-command deploys
- Features that "just work" without reading docs
- Speed improvements — anything that saves her team time

### What Frustrates Her
- Breaking changes without migration paths
- Enterprise-focused features that add complexity
- Documentation that assumes you've read everything else first

### How She'd Evaluate Sprint Co's Output
"Did this make my team faster? Can I explain it to a new hire in one sentence? Did it break anything?"

### Sample Feedback Quotes
- "I don't care if the code is beautiful — does it work?"
- "Why did this sprint spend 4 hours on refactoring? Ship features."
- "This deploy-in-one-click thing is exactly what I needed."
- "Stop adding config options. Pick a default and move on."

---

## Persona 2: James Rodriguez

**Role:** Enterprise IT Administrator (Fortune 500, 2000+ developers)

### Key Needs
- Reliability — uptime, predictable behavior, no surprises
- Security — audit trails, access controls, compliance
- API stability — breaking changes break his 50-service integration

### Pain Points
- Undocumented behavior ("I found out about this by reading the source code")
- Missing audit logs ("Our compliance team needs to know who changed what")
- Casual versioning ("You shipped a breaking change in a patch release?")

### What Delights Him
- Comprehensive API documentation with examples
- Semantic versioning strictly followed
- Detailed changelog entries
- Role-based access controls

### What Frustrates Him
- "Move fast and break things" mentality
- Features released without documentation updates
- Deprecations without adequate notice periods

### How He'd Evaluate Sprint Co's Output
"Is this production-ready? Can I put this in front of our security team? Is the API contract stable?"

### Sample Feedback Quotes
- "Where's the changelog entry for this endpoint change?"
- "This needs an audit log before I can deploy it."
- "The API docs are excellent — my team integrated in an afternoon."
- "Please don't break the v2 API. We have 30 services depending on it."

---

## Persona 3: Aisha Patel

**Role:** Solo Developer (freelancer, builds side projects and client apps)

### Key Needs
- Simplicity — she's one person, no time for complexity
- Great DX — clear errors, helpful CLI, smart defaults
- Quick setup — working prototype in under 5 minutes

### Pain Points
- Boilerplate ("I have to create 6 files just to add one feature?")
- Poor error messages ("Error: undefined — thanks, very helpful")
- Assumed context ("This doc assumes I know what a 'control plane' is")

### What Delights Her
- Generators and scaffolding tools
- Error messages that tell her exactly what to fix
- Copy-paste-ready examples in docs

### What Frustrates Her
- Complex terminology without explanation
- Features that require understanding the full architecture
- CLI commands with too many required flags

### How She'd Evaluate Sprint Co's Output
"Can I use this without reading a 50-page spec? Does the error tell me what's wrong? Is there a quick-start guide?"

### Sample Feedback Quotes
- "I just want to `npm install` and go. Why do I need Docker?"
- "The error message said 'ENOENT' — can it just say 'file not found: config.yaml'?"
- "The quick-start guide got me running in 3 minutes. Love it."
- "Why are there 12 config options? I don't know what half of them do."

---

## Persona 4: Tom Anderson

**Role:** Product Manager (B2B SaaS, 50-person company)

### Key Needs
- Features that look good in demos
- Visual polish — the board judges products by their UI
- Metrics and dashboards he can show to stakeholders

### Pain Points
- Ugly defaults ("I can't show this to the CEO")
- Missing visualization ("Where's the chart? I just see a table of numbers")
- No export options ("I need this in a slide deck by Friday")

### What Delights Him
- Beautiful dashboards with real-time data
- Export to PDF/PNG for presentations
- Status pages he can share with customers
- Feature flags he can toggle without deploying

### What Frustrates Him
- Terminal-only interfaces ("Not everyone lives in a terminal")
- Raw JSON responses ("Can I get a human-readable version?")
- Features without visual indication of success/failure

### How He'd Evaluate Sprint Co's Output
"Can I screenshot this for a board presentation? Does it make our product look professional? Is there a dashboard?"

### Sample Feedback Quotes
- "The dashboard looks great — can we add a dark mode?"
- "I need a way to show sprint velocity to the board."
- "This feature works perfectly but looks like a prototype."
- "Can we get a status page I can share with customers?"

---

## Persona 5: Li Wei

**Role:** Open Source Maintainer (popular library, 500+ GitHub stars)

### Key Needs
- Extensibility — plugin system, hooks, customization points
- Code quality — clean architecture, well-tested, readable source
- Community-friendly — good contribution guidelines, issue templates

### Pain Points
- Monolithic design ("I can't use just the part I need")
- Poor test coverage ("How do I know this refactor is safe?")
- Closed architecture ("I want to add a custom adapter but there's no extension point")

### What Delights Him
- Plugin architecture with clear interfaces
- >90% test coverage with meaningful tests
- Well-documented internal architecture
- Modular packages he can use independently

### What Frustrates Him
- God objects and tight coupling
- Tests that test implementation rather than behavior
- "Not invented here" syndrome — reinventing standard tools

### How He'd Evaluate Sprint Co's Output
"Is the code well-architected? Can I extend it without forking? Are there tests? Would I accept this PR in my project?"

### Sample Feedback Quotes
- "The adapter pattern is clean — easy to add new providers."
- "This function does 5 things. Split it up."
- "Great test coverage on the core module."
- "Why did you build a custom logger instead of using pino?"

---

## Persona Rotation

### Schedule
- Current persona set is reviewed every **20 sprints**
- Stakeholder may propose replacing up to 2 personas per rotation
- New personas must cover a gap in the current set (e.g., missing a mobile developer perspective)

### Rotation Process
1. Stakeholder proposes new persona(s) with full profile
2. Critic reviews: "Does this persona add signal we're not getting?"
3. Board approves the rotation
4. Old persona profiles are archived (not deleted) for historical reference

### Rotation Triggers (outside normal schedule)
- Sprint Co pivots to a new market segment
- 3+ consecutive sprints where no persona represents the primary user type
- Feedback data shows a user archetype not captured by any persona
