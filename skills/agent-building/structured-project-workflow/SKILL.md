---
name: structured-project-workflow
category: dev-workflow
description: Run the complete project lifecycle in Claude Code from raw idea to shipped product. Use when managing a Claude Code project without external tools, setting up CLAUDE.md with invariants, creating TASK.md for spec tracking, applying the plan-approve-execute pattern, or structuring work across sessions. Triggers on: "structured project workflow", "idea to shipped product", "spec-driven development", "claude code project management", "TASK.md", "PRD claude code", "project spec template", "how do I manage a project in claude code", "no jira claude code", "project drift", "losing context between sessions", "vibe coding to structure", "5-phase workflow", "plan mode for project planning". NOT for: multi-agent team coordination (skill #003), git worktree mechanics (skill #005), TDD loops (skill #007), MCP configuration (skill #006).
---

# Structured Project Workflow

Most Claude Code projects fail the same way: no structure, no invariants, AI goes in circles, developer re-explains context every session. This skill teaches the 5-phase lifecycle that runs entirely in your repo — no Jira, no Linear, no Notion.

**Core thesis:** CLAUDE.md is your wiki. TASK.md is your backlog. Git history is your activity log. The AI always has full context because everything lives where it works.

## Quick Entry

| Goal | Reference |
|---|---|
| Understand the full 5-phase lifecycle | [01-lifecycle-overview.md](references/01-lifecycle-overview.md) |
| Turn a raw idea into a spec (PRD template + invariants) | [02-phase1-idea-to-spec.md](references/02-phase1-idea-to-spec.md) |
| Break a spec into implementation-ready TASK.md steps | [03-phase2-spec-to-tasks.md](references/03-phase2-spec-to-tasks.md) |
| Run the plan-approve-execute loop + session handoff | [04-phase3-implementation-loop.md](references/04-phase3-implementation-loop.md) |
| Set up quality gates (hooks + done criteria) | [05-phase4-quality-gates.md](references/05-phase4-quality-gates.md) |
| Create a PR with gh CLI + changelog entry | [06-phase5-ship-it.md](references/06-phase5-ship-it.md) |
| Configure CLAUDE.md as your project brain | [07-claude-md-project-brain.md](references/07-claude-md-project-brain.md) |
| Scale with parallel worktrees and subagents | [08-scaling-parallel-subagents.md](references/08-scaling-parallel-subagents.md) |

## The 5-Phase Lifecycle

```
Idea → Spec → Task Breakdown → Implementation Loop → Ship
 ↑                                                     |
 └─────────────── CLAUDE.md tracks state ─────────────┘
```

| Phase | Input | Output | Key Primitive |
|---|---|---|---|
| **1. Idea → Spec** | Raw idea | PRD + CLAUDE.md invariants | Plan mode |
| **2. Spec → Tasks** | PRD | TASK.md with steps + acceptance criteria | Read/Write |
| **3. Implementation Loop** | TASK.md step | Working code + step marked done | Bash + Edit loop |
| **4. Quality Gates** | Code changes | Validated build + tests pass | Hooks |
| **5. Ship** | Done tasks | Merged PR + changelog entry | gh CLI |

## Core Files

**CLAUDE.md** — Invariants, architecture decisions, anti-patterns. Claude reads this every session. Vague CLAUDE.md = drift.

**TASK.md** — Sequential spec steps with acceptance criteria and status. Carries context across sessions. Full templates in [03-phase2-spec-to-tasks.md](references/03-phase2-spec-to-tasks.md) and [07-claude-md-project-brain.md](references/07-claude-md-project-brain.md).

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I don't need TASK.md, I'll just ask Claude each session" | Re-explaining context burns 20% of every session. Write it once in TASK.md. |
| "CLAUDE.md is for global rules, not project notes" | CLAUDE.md can and should have project-specific sections. That's what `## Project: [Name]` headers are for. |
| "The spec is clear in my head, I don't need to write it" | In your head it stays. Claude Code has no head. Write the spec. |
| "Plan mode is overkill for small features" | Plan mode catches scope creep before it touches code. Use it on anything > 2 files. |
| "I'll add acceptance criteria later" | You won't. And without them, you don't know when a step is done — neither does Claude. |
| "This project is too big to spec all upfront" | You don't spec it all upfront. Phase 2 breaks it into steps. Do Phase 1 first. |

No external services. No dependencies. Everything runs in the repo with `gh` CLI for Phase 5 PRs.
