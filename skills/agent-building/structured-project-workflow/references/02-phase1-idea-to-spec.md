# Phase 1: Idea → Spec

## What This Phase Does

Transforms an unstructured idea into two artifacts:
1. **PRD.md** — problem, audience, scope, non-goals, success criteria
2. **CLAUDE.md project section** — invariants (what this project NEVER does)

Use plan mode for the entire phase. No files touched until you've thought through scope.

## Plan Mode First

Start every project in plan mode:

```bash
# In Claude Code, press Shift+Tab to enter plan mode
# Plan mode: Claude analyzes, proposes, waits for approval
# No edits until you approve
```

In plan mode, tell Claude:
> "I want to build [brief description]. Help me spec it. Ask me clarifying questions. Then produce a PRD.md and write the project section of CLAUDE.md with architectural invariants."

Claude asks 3-5 questions. You answer. It drafts.

## PRD.md Template

```markdown
# [Project Name] — Product Requirements

## Problem
[1-2 sentences: what fails for the user without this]

## Audience
[Who this is for, their context, their pain]

## Scope (In)
- [Feature 1]
- [Feature 2]
- [Feature 3]

## Non-Goals
- [What this NEVER does — explicit]
- [Adjacent features deferred to later]

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] [Measurable outcome 3]

## Constraints
- [Technical constraints, platform, timeline]
- [Dependencies on other systems]
```

## CLAUDE.md Invariants Section

Invariants are constraints that can NEVER be violated. They're written once and read by Claude at the start of every session.

```markdown
## Project: [Name]

### Invariants (Never Violate)
- NEVER use [library X] — we use [library Y] for [reason]
- NEVER modify the [module] without updating [related module]
- NEVER expose [sensitive data] in [place]
- Database schema changes require a migration file

### Architecture Decisions
- State management: [chosen approach and why]
- API layer: [pattern and why]
- Auth: [approach and why]

### Current Phase
Phase: [1/2/3/4/5]
Active step: [step N - description]
Last session: [what was done, what's next]
```

## Common Mistakes

**Missing non-goals:** Every scope needs an explicit non-goals list. Without it, Claude adds features you didn't ask for.
**No invariants:** The #1 cause of project drift. Write at least 3 invariants per project.

## Checklist: Phase 1 Complete

- [ ] PRD.md exists with problem, scope, non-goals, success criteria
- [ ] CLAUDE.md has a project section with at least 3 invariants
- [ ] Architecture decisions documented (even if provisional)
- [ ] Ambiguous requirements resolved via plan mode questions
- [ ] Non-goals are explicit, not implied
