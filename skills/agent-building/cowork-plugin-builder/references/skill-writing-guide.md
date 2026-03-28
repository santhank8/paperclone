# Skill Writing Guide

## Frontmatter

```yaml
---
name: skill-name
description: >
  Third-person description starting with action context. Include trigger
  phrases in quotes. Max 1024 chars.
  "trigger phrase one", "trigger phrase two", "trigger phrase three".
metadata:
  version: "0.1.0"
---
```

**Description rules:**
- Third-person: "This skill should be used when..." or "Prepare for X when the user asks to..."
- Include 3-5 trigger phrases users would naturally say, in quotes
- Include what the skill is NOT for (prevents false positives)
- Under 1024 characters

## Body Structure

### For Knowledge Skills (domain expertise)

```markdown
# Skill Title

<1-2 sentence overview>

## Core Concepts
<Key abstractions the model needs>

## Workflow
<Step-by-step execution>

## Output Format
<Template for structured output>

## Additional Resources
- **references/detailed-guide.md** - expanded reference material
```

### For Action Skills (user-initiated workflows)

```markdown
# Skill Title

<What this does and when it fires>

## How It Works
<Visual flow diagram using ASCII/box drawing>

## Getting Started
<What the skill needs from the user>

## Connectors (Optional)
<Table of tools that enhance the skill>

## Execution Flow

### Step 1: Gather Context
<What to collect and from where>

### Step 2: Process
<What to do with the gathered context>

### Step 3: Output
<Format and deliver results>

## Output Format
<Template with placeholders>

## Tips
<3-5 practical tips for better results>
```

## Writing Rules

1. **Imperative voice**: "Parse the config file." Not "You should parse the config file."
2. **Instructions FOR Claude**: Skills are directives, not documentation for users
3. **Under 3,000 words** (target 1,500-2,000). Move detail to `references/`
4. **Tables over prose** for comparisons, mappings, checklists
5. **Code blocks** for any command the user will copy
6. **No fluff**: "This section covers X" is just "X"
7. **No obvious information**: Claude already knows how to code

## Progressive Disclosure

1. **Metadata** (always in context): name + description (~100 words)
2. **SKILL.md body** (when skill triggers): core knowledge (<5k words)
3. **references/** (as needed): detailed docs, examples, scripts (unlimited)

## Connector-Aware Skills

For skills that work with external tools, use this pattern:

```markdown
## How It Works

┌─────────────────────────────────────────────────────────┐
│  ALWAYS (works standalone)                               │
│  + You tell me: basic inputs                            │
│  + Web search: supplementary research                   │
│  + Output: formatted result                             │
├─────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools connected)                     │
│  + CRM: account history, contacts                       │
│  + Email: recent threads                                │
│  + Chat: internal discussions                           │
└─────────────────────────────────────────────────────────┘
```

This pattern ensures the skill works without any connectors but gets better with them.

## Data Source Priority Pattern (Financial/Data Plugins)

When a skill uses data from multiple sources, enforce priority:

```markdown
## Data Source Priority (READ FIRST)

1. **FIRST: Check MCP data sources** - if available, use exclusively
2. **DO NOT use web search** if MCP sources are available
3. **ONLY if MCPs unavailable:** use secondary sources
4. **NEVER use web search as primary** for accuracy-critical data
```

## Common Skill Patterns

### Meeting/Call Prep
Input: company/person name, meeting type
Flow: gather context (CRM + email + web) -> research attendees -> synthesize -> format brief
Output: structured prep brief with agenda, questions, talking points

### Pipeline/Status Review
Input: filter criteria (date range, status, owner)
Flow: query tool -> aggregate -> identify highlights/risks -> format
Output: summary with key metrics, risk flags, action items

### Content Creation
Input: topic, audience, constraints
Flow: research -> outline -> draft -> format
Output: formatted content matching the role's standards

### Triage/Classification
Input: incoming items (tickets, emails, tasks)
Flow: read -> classify -> prioritize -> route
Output: sorted list with categories and recommended actions

### Analysis/Modeling
Input: target entity, analysis type
Flow: gather data -> apply framework -> calculate -> visualize
Output: structured analysis (often Excel/spreadsheet)

## Quality Checklist

- [ ] Description includes 3+ trigger phrases in quotes
- [ ] Description says what the skill is NOT for
- [ ] Body under 3,000 words
- [ ] Imperative voice throughout
- [ ] Output format template included
- [ ] Execution flow is step-by-step
- [ ] References used for content over 100 lines
- [ ] Works standalone (no required connectors)
- [ ] Enhanced by connectors (when available)
