---
schema: agentcompanies/v1
kind: team
slug: engineering
name: Engineering Team
description: >
  Responsible for implementing features from the sprint backlog.
  Owns technical architecture, code quality, and feature delivery within the sprint window.
company: sprint-co
---

# Engineering Team

## Purpose

The Engineering Team turns `sprint-plan.md` into working software. Sprint Lead sets up the architecture and routes work. Engineer Alpha and Beta implement features in parallel where possible, self-evaluate before handoff, and respond to QA feedback.

## Agents

| Agent | Role |
|-------|------|
| Sprint Lead | Tech architect, task routing, velocity management |
| Engineer Alpha | Full-stack generator (frontend-heavy) |
| Engineer Beta | Backend/API generator (backend-heavy) |

## Responsibilities

1. **Architecture Setup** (Sprint Lead): Read `sprint-plan.md`, scaffold repo/tech stack, create `task-breakdown.md`
2. **Feature Implementation** (Alpha/Beta): One feature at a time, per sprint backlog order
3. **Self-Evaluation** (Alpha/Beta): Brief self-critique before every QA handoff
4. **QA Response** (Alpha/Beta): Receive eval report, make strategic refine-or-pivot decision
5. **Velocity Management** (Sprint Lead): Monitor clock, drop V2 features if behind

## Tech Stack (Default)

- **Frontend**: React + Vite + TypeScript
- **Backend**: FastAPI (Python) or Node.js (Express/Hono)
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Deployment**: Cloudflare Workers/Pages

## Parallelism Rules

- Sprint Lead assigns non-dependent tasks to Alpha and Beta simultaneously
- Frontend-heavy tasks → Engineer Alpha
- Backend/API/DB tasks → Engineer Beta
- When tasks are sequential, Alpha and Beta work one at a time

## Success Criteria

- All V1 features implemented and passing QA by 2h45m mark
- Every feature has passing Playwright tests
- No 500 errors in production
- Self-evaluation is honest (not optimistic)

## Inputs

- `sprint-plan.md` from Product Team

## Outputs

- Feature branches / commits
- `handoff-[feature].md` per feature (what was built, how to test, known issues)
- `task-breakdown.md` (Sprint Lead, produced at start)
