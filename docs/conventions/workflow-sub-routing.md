# Convention: Workflow Sub-Routing

## Overview

A pattern for skills with 3+ distinct modes. SKILL.md acts as a router dispatching to separate `Workflows/[Name].md` files. Keeps SKILL.md scannable (under 100 lines) while allowing arbitrarily deep workflows.

## When to Use Sub-Routing

| Condition | Decision |
|-----------|----------|
| Skill has 1-2 modes | Keep flat — no sub-routing needed |
| Skill has 3+ distinct modes | Use sub-routing |
| SKILL.md exceeds 150 lines | Extract to Workflows/ |
| SKILL.md under 150 lines with one mode | Keep flat |

## Directory Structure

```
skills/[category]/[skill-name]/
├── SKILL.md              ← Router: frontmatter + routing table + dispatch rules
├── Workflows/
│   ├── [WorkflowA].md    ← Self-contained workflow
│   └── [WorkflowB].md    ← Self-contained workflow
└── references/            ← Supporting content (unchanged)
```

## SKILL.md Router Pattern

```markdown
---
name: skill-name
description: [triggers as before]
---

# Skill Name

[1-2 sentence overview]

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| [trigger phrases] | `Workflows/WorkflowA.md` |
| [trigger phrases] | `Workflows/WorkflowB.md` |
| [default/fallback] | [inline quick answer OR specific workflow] |

## Dispatch Rules
- Read the matched workflow file and follow its instructions
- If no pattern matches, [default behavior]
- Workflows may reference files in `references/` for supporting content
```

## Workflow File Pattern

```markdown
# [Workflow Name]

## When to Use
[Specific triggers and context]

## Steps
[Self-contained implementation steps]

## Verification
[How to verify this workflow completed correctly]
```

## Rules

- A skill with 1-2 modes doesn't need sub-routing — keep it flat
- Sub-routing is for skills with 3+ distinct modes or where SKILL.md exceeds 150 lines
- Workflow files can reference `../references/` content
- Frontmatter stays in SKILL.md only — workflow files are instructions, not skills
- Workflow files are the single source of truth for their domain — no duplicate content in SKILL.md

## Publish Script

`publish-skill.ts` bundles Workflows/ alongside references/ in the published output. Both directories are included automatically — no extra configuration needed.
