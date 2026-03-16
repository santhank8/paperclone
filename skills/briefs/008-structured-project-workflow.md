# Skill Brief: Structured Project Workflow — Idea to Shipped Product in Claude Code

## Demand Signal

- Reddit r/ClaudeCode: "I Built a Spec-Driven Development Workflow for Claude Code" — 200+ upvotes, 60 comments (Jul 2025)
- Reddit r/ClaudeCode: "Large SaaS Claude Workflow" — 150+ upvotes, 40 comments (Feb 2026)
- Reddit r/ClaudeCode: "Structured Multi-Agent Coding Workflow" — 120+ upvotes, 30 replies
- GitHub: Pimzino/claude-code-spec-workflow — 300+ stars (users building their own because nothing native exists)
- GitHub: github.com/anthropics/claude-code issue #32627 — developer submitted a detailed 10-phase pipeline they built from scratch
- X/Twitter: @AlexFinn thread on Claude Code project tasks — 400 likes, 150 reposts
- X/Twitter: @nityeshaga "How We Built an AI Project Manager Using Claude Code" — 300 likes, 100 replies
- Medium: "Using Spec-Driven Development with Claude Code" by Heeki Park — 500+ claps
- No competing skill on ClawHub — confirmed gap in the top 30 skills
- Core pain: ~40% of discussions cite project drift and lack of structure as the primary failure mode for longer Claude Code projects

## Target Audience

Developers building features or products with Claude Code who are:
- Getting burned by "vibe coding" — AI goes in unpredictable directions without a plan
- Managing their projects in Jira/Linear/Notion while coding in Claude Code (context-switching tax)
- Starting mid-complexity projects solo and losing coherence after a few sessions
- Spending more time re-explaining context than writing code

They want structure. They've tried CLAUDE.md but don't know what to put in it. They've seen the spec-driven pattern mentioned online but haven't formalized it.

## Core Thesis

Claude Code can be your entire project management system — no Jira, no Linear, no Notion. CLAUDE.md is your wiki, TASK.md is your backlog, git history is your activity log, and the AI never loses context because everything lives in the repo.

## Skill Scope

### In Scope
- 5-phase lifecycle: Idea → Spec → Task Breakdown → Implementation Loop → Ship
- CLAUDE.md as the project brain (invariants, architecture decisions, anti-patterns)
- TASK.md structure for spec tracking (steps, acceptance criteria, status)
- Plan mode for safe analysis before implementation
- Quality gates via hooks (pre-commit validation, build checks)
- PR creation and changelog entry using gh CLI
- Context management across sessions using CLAUDE.md + TASK.md
- Scaling with subagent delegation for parallel work

### Out of Scope
- Multi-agent coordination setup (covered in skill #003)
- Git worktree mechanics (covered in skill #005)
- TDD red-green-refactor loop (covered in skill #007)
- MCP configuration (covered in skill #006)
- Team/enterprise workflows with shared context

## Sections

1. **The 5-Phase Lifecycle** — Overview of the full pipeline from raw idea to merged PR. How the phases connect, what lives where, and how Claude Code tracks state without external tools.

2. **Phase 1: Idea → Spec** — Use plan mode to brainstorm without touching code. PRD template (problem, audience, scope, non-goals). Writing architectural invariants into CLAUDE.md so the AI never violates them.

3. **Phase 2: Spec → Task Breakdown** — TASK.md structure: sequential steps, acceptance criteria per step, status tracking. How to decompose a PRD into implementation-ready steps Claude Code can execute autonomously.

4. **Phase 3: The Implementation Loop** — The plan-approve-execute pattern for each spec step. Running spec steps unattended with auto-verification. Context handoff pattern between sessions (CLAUDE.md + TASK.md carry all state).

5. **Phase 4: Testing & Quality Gates** — Hook-based validation (PreToolUse to block bad patterns, PostToolUse to auto-run tests). What "done" looks like for a spec step. Review checklist before marking complete.

6. **Phase 5: Ship It** — Creating a PR with gh CLI (pre-populated from TASK.md and git log). Changelog entry format. Deploy verification pattern. Marking TASK.md complete and archiving to git.

7. **CLAUDE.md as Project Brain** — Three-layer structure: global rules, project invariants, session state. How invariants prevent drift across long projects. Anti-pattern table (what kills projects — fragile CLAUDE.md, missing acceptance criteria, skipped quality gates).

8. **Scaling: Parallel Worktrees and Subagents** — When a single context isn't enough: parallel worktrees for independent features, subagent delegation for routine steps, orchestrator pattern for multi-feature releases.

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Take a raw idea and produce a CLAUDE.md with invariants + TASK.md with implementation steps in under 30 minutes
- [ ] Execute a spec step through the full plan-approve-execute loop
- [ ] Resume a project after a week away without re-explaining context to Claude Code
- [ ] Create a properly described PR using gh CLI auto-populated from TASK.md
- [ ] Identify and fix a project that's drifted (hallucinating architecture, violating invariants) using CLAUDE.md
- [ ] Never open Jira/Linear/Notion for solo project management again

## Keywords

claude code project workflow, spec-driven development, idea to shipped product, claude code project management, TASK.md, PRD claude code, project spec template, claude code planning, structured workflow, claude code lifecycle, no jira claude code, SDD claude code

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| Pimzino's spec-workflow tool (300+ stars) | No tool install — native primitives only |
| Manage specs in Notion/Linear, code in Claude | Everything in the repo — AI always has full context |
| Start from scratch every session (vibe coding) | CLAUDE.md + TASK.md carry all state between sessions |
| Custom 10-phase pipelines (DIY, breaks easily) | Opinionated 5-phase template that composes with other skills |
| "Plan mode" for one-off planning | Plan mode as Phase 1 of a reproducible lifecycle |

## Estimated Complexity

Medium. No external dependencies. Builds on primitives developers already use (CLAUDE.md, git, gh CLI). The skill is teaching workflow composition and discipline, not new tools. References skills #005 (git worktrees) and #003 (multi-agent) for the scaling section but those are optional paths.
