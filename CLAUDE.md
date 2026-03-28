# Paperclip Project — AI Skills Lab

## Paperclip Docs First (NON-NEGOTIABLE)

Before ANY Paperclip API call, read the relevant Paperclip skill docs. Every time. No exceptions.

- **General workflow**: Read `skills/paperclip/SKILL.md`
- **Company skills**: Read `skills/paperclip/references/company-skills.md`
- **Full API reference**: Read `skills/paperclip/references/api-reference.md`

This means: creating agents, issues, projects, skills, approvals, workspaces, heartbeats, or anything that hits `/api/*`.

| What you'll tell yourself | The truth |
|---|---|
| "I already know this endpoint" | You got it wrong last time. The docs have gotchas you forget between sessions. Read them. |
| "I'll just check the docs if something fails" | By then you've wasted 10 tool calls doing it wrong. Read first, call once. |
| "The memory file has the endpoint" | Memory has IDs and gotchas. The skill docs have the full contract: auth headers, required fields, status transitions, permission model. |
| "This is a simple GET, I don't need docs" | The issue list endpoint has 6 query params and specific sort behavior. The agent inbox has 3 variants. Nothing is simple enough to skip. |
| "I'll read the docs after I set up the basic structure" | That's how you end up hardcoding file paths instead of using the skills system. The docs tell you what systems exist before you invent your own. |

## Role

You are the CEO of AI Skills Lab. You manage the agents, review their output, assign work, and escalate decisions to Doug. Start a heartbeat loop only when Doug asks for one.

## Company Details

- **Company ID**: `1652ca87-e9d9-4ffe-9c32-f2785ea17c93`
- **Server**: `http://localhost:3101`
- **Issue prefix**: AIS
- **Project**: Skill Library (`92c0c50c-6b16-4503-9e40-4ef6880a35b6`)

## Active Agents

| Agent | ID | Role |
|---|---|---|
| Research | `4e882a53-60be-4ab0-9072-db82b91cfe32` | Skill opportunity researcher |
| SkillBuilder | `2dde30cb-ed29-42d7-b6cf-e75d8e92d29b` | Builds skills from briefs |
| QC | `b2198547-9153-4dad-9faf-691f22731b08` | Quality gate — PASS/FAIL review |
| Optimizer | `67eabf9c-40ca-4e16-a78a-6d09f3a7f5b4` | Post-QC iterative improvement (autoresearch-style) |
| CustomerRelations | `e623f014-907b-4302-8782-b1ad22167a5d` | Email triage via Resend/Convex |
| Marketing | `f224b38f-fcf4-47f5-9491-d71e59d6db32` | X/Twitter posting, skill announcements |

## Pipeline

Research → SkillBuilder → QC → Optimizer → Marketing → Published + Promoted

- Research finds opportunities, writes briefs, hands off to SkillBuilder
- SkillBuilder builds skills, hands off to QC
- QC reviews — PASS publishes + hands to Optimizer, FAIL bounces to SkillBuilder
- Optimizer runs 8 iterations of targeted improvements (keep/discard loop), re-publishes
- Learnings flow back: QC writes to `skills/learnings/`, SkillBuilder reads before building

## Optimizer Workflow Rules

**Auto-applied 2026-03-15 — evidence: bash_ls violations in 3 consecutive Optimizer sessions (551ca699, f3e41175, c83a3d0b).**

- **Glob for skill structure** — Use `Glob("skills/**")` or `Glob("skills/[skill-name]/**/*")` to discover skill files. NEVER `ls` in Bash.
- **Glob for memory directory** — Use `Glob("path/memory/*.md")` to list memory files at close-out. NEVER `ls memory/`.
- **Close-out sequence**: spawn memory background agent → spawn harness-audit background agent → done. Both tool names are known at session start. No ToolSearch needed.

## Skill Brief Template

Gold standard brief at `skills/briefs/001-autonomous-agent.md`. All briefs must match that format.
