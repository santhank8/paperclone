---
schema: agentcompanies/v1
kind: skill
name: sprint-planner
description: >
  Skill for the Product Planner agent. Covers brief expansion methodology, sprint backlog format,
  V1/V2/V3 scope labeling rules, and the sprint-plan.md handoff artifact format.
---

# Sprint Planner Skill

## Overview

The Product Planner transforms a raw brief (1–4 sentences) into a precise, executable `sprint-plan.md` in 20 minutes. This skill covers the complete methodology.

---

## 1. Brief Expansion Methodology

### Step 1: Brief Decomposition
Extract these from the brief before writing anything:

```
Core question: What is the ONE thing a user should be able to do?
Product type: [CRUD app | Tool | Dashboard | Landing page | API | Integration]
Primary user: [Who is using this?]
Data entities: [What are the main nouns? e.g., "users", "tasks", "products"]
Happy path: [In 3–5 steps, what does a successful user do?]
```

### Step 2: Scope Boundary Check
Before writing the spec, explicitly answer:
- What is DEFINITELY in scope? (the brief says so explicitly)
- What is PROBABLY in scope? (reasonable assumption from context)
- What is DEFINITELY out of scope? (common feature people add that the brief didn't mention)

### Step 3: Tech Stack Decision
Default stack (use unless brief specifies otherwise):
- **Simple CRUD / tool**: React + Vite + TS + Hono + SQLite
- **Marketing / landing page**: Astro or plain React + Vite
- **Data-heavy / dashboard**: React + Vite + TS + FastAPI + PostgreSQL
- **API-only**: Node.js + Hono + SQLite

### Step 4: Data Model
List entities and their key fields. Keep it minimal — only fields the V1 feature set actually needs.

```markdown
## Data Model
- **User**: id, email, passwordHash, createdAt
- **Task**: id, userId (FK), title, description, status, createdAt, completedAt
```

### Step 5: Primary User Flow
Write the happy path as numbered steps. This becomes the acceptance criteria backbone.

```markdown
## Primary User Flow
1. User visits homepage
2. User clicks "Create Task"
3. User fills in title and description
4. User clicks Save
5. Task appears in list
6. User can mark task complete
7. Completed task shows in "Done" column
```

---

## 2. Sprint Backlog Format

Each item in the sprint backlog follows this format:

```markdown
#### [TASK-XXX] [Concise Task Title]
- **Description**: [What to build — 1–3 sentences]
- **Acceptance Criteria**:
  - [ ] [Specific, testable criterion]
  - [ ] [Another criterion]
- **Estimate**: [15 | 30 | 45] min
- **Assign to**: [Alpha | Beta | Lead]
- **Depends on**: [TASK-XXX or "none"]
- **V-Label**: [V1 | V2 | V3]
```

### Estimation Rules
- **15 min**: Single UI component, single API endpoint, DB schema only
- **30 min**: A full feature slice (UI + API + DB)
- **45 min**: Complex feature with multiple states, auth, or integration

If a task would take >45 minutes, split it.

Total V1 task estimate MUST fit within 100 minutes (implementation window). If it doesn't, convert lower-priority V1 items to V2.

---

## 3. V-Label Rules

### V1 — Must Ship
The core value of the product cannot be demonstrated without this feature.

**Rule**: Would a user be confused or unable to use the product without this? → V1

Examples:
- A task app without the ability to create tasks → V1
- User authentication (if the app has per-user data) → V1
- The primary data display (the list, the dashboard, the main view) → V1

### V2 — Ship If Time Allows
Enhances the product but the core use case works without it.

**Rule**: Can a user get value from the product without this? → V2

Examples:
- Search / filter on a list
- Edit functionality (if create is V1)
- Email notifications
- Profile settings

### V3 — Future Sprint
Good ideas that are definitely out of scope for this sprint.

**Rule**: Wasn't in the brief AND would meaningfully expand scope → V3

Examples:
- Mobile app version
- Third-party integrations not mentioned in brief
- Admin dashboard
- Analytics

### Anti-Scope-Creep Checklist
Before finalizing the spec, check:
```
[ ] Did the brief mention this feature? → V1
[ ] Is this implied by the brief context? → V1 or V2
[ ] Is this something "every app should have"? → V2 (at most)
[ ] Did I think of this because it's cool? → V3
[ ] Would removing this break the core use case? → If no → V2
```

---

## 4. sprint-plan.md Complete Format

```markdown
# Sprint Plan — [Sprint ID]

**Brief**: "[original brief verbatim]"
**Planner**: Product Planner
**Date**: [YYYY-MM-DD]
**Sprint Window**: 3 hours from [HH:MM]

---

## Product Spec

### Product Name
[Short name]

### Core Value Proposition
[One sentence: "This product lets [user] [do thing] so they can [outcome]."]

### Target User
[1–2 sentences describing who uses this]

### Primary User Flow (Happy Path)
1. [Step]
2. [Step]
...

### Data Model
- **[Entity]**: [field: type, field: type, ...]

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Hono (Node.js) |
| Database | SQLite + Drizzle ORM |
| Deployment | Cloudflare Workers/Pages |

### Non-Goals (V2+)
These will NOT be built in this sprint:
- [Feature] — V2
- [Feature] — V3

---

## Sprint Backlog

### V1 — Must Ship
**Total V1 estimate**: [X] min of 100 available

[tasks in dependency order]

### V2 — Ship If Time Allows

[tasks]

### V3 — Future

[ideas, no tasks]

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [risk] | High/Med/Low | High/Med/Low | [how to handle] |

---

## Handoff to Sprint Lead

**Status**: READY
**Time Elapsed**: [X] min of 20 budget
**Next**: Sprint Lead — read this plan, scaffold the repo, create task-breakdown.md
**Key Decisions Made**: [list any non-obvious calls you made]
```
