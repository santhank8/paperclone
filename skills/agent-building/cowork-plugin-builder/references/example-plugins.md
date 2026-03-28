# Example Plugin Structures

Three complete examples at different complexity levels. Use as templates.

## Minimal: Single Skill Plugin

```
meeting-notes/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── meeting-notes/
│       └── SKILL.md
└── README.md
```

**plugin.json:**
```json
{
  "name": "meeting-notes",
  "version": "0.1.0",
  "description": "Generate structured meeting notes from transcripts",
  "author": { "name": "Cowork Plugin Studio" }
}
```

**skills/meeting-notes/SKILL.md:**
```yaml
---
name: meeting-notes
description: >
  Generate structured meeting notes from a transcript. Use when the user asks
  to "summarize this meeting", "create meeting notes", "extract action items
  from this transcript", or provides a meeting transcript file.
---
```
```markdown
Read the transcript and generate structured meeting notes.

Include:
1. **Attendees** - all participants mentioned
2. **Summary** - 2-3 sentence overview
3. **Key Decisions** - numbered list
4. **Action Items** - table: Owner, Task, Due Date
5. **Open Questions** - unresolved items

Write notes to a new file named after the transcript with `-notes` appended.
```

---

## Standard: Skills + MCP Connectors

```
code-quality/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── coding-standards/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── style-rules.md
│   ├── review-changes/
│   │   └── SKILL.md
│   └── fix-lint/
│       └── SKILL.md
├── .mcp.json
└── README.md
```

**.mcp.json:**
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

---

## Full-Featured: Skills + Agents + Hooks + MCP + Connectors

```
engineering-workflow/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── team-processes/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── workflow-guide.md
│   ├── standup-prep/
│   │   └── SKILL.md
│   └── create-ticket/
│       └── SKILL.md
├── agents/
│   └── ticket-analyzer.md
├── hooks/
│   └── hooks.json
├── .mcp.json
├── CONNECTORS.md
└── README.md
```

**agents/ticket-analyzer.md:**
```yaml
---
name: ticket-analyzer
description: Use this agent when the user needs to analyze tickets, triage
  incoming issues, or prioritize a backlog.

<example>
Context: User is preparing for sprint planning
user: "Help me triage these new tickets"
assistant: "I'll use the ticket-analyzer agent."
</example>

model: inherit
color: cyan
tools: ["Read", "Grep"]
---

You are a ticket analysis specialist. Analyze tickets for priority,
effort, and dependencies.

**Output Format:**
| Ticket | Type | Effort | Dependencies | Priority |
|--------|------|--------|-------------|----------|
```

**hooks/hooks.json:**
```json
{
  "SessionStart": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "echo '## Team Context\n\nSprint: 2 weeks. Standup: daily 9:30.'",
          "timeout": 5
        }
      ]
    }
  ]
}
```

---

## Real-World Reference Plugins

The Anthropic repos contain production-quality examples:

### knowledge-work-plugins (11 plugins)
| Plugin | Skills | Pattern |
|--------|--------|---------|
| sales | 9 | Connector-aware action skills (call-prep, pipeline-review) |
| engineering | 10 | Knowledge + action mix (standup, code-review, architecture) |
| customer-support | varies | Triage + KB generation pattern |
| product-management | varies | Spec writing + roadmap + research synthesis |
| marketing | varies | Content + campaigns + brand voice |
| legal | varies | Contract review + compliance + NDA triage |
| finance | varies | Journal entries + reconciliation + statements |
| data | varies | SQL + visualization + statistical analysis |
| enterprise-search | varies | Cross-tool unified search |

### financial-services-plugins (5 plugins, 41 skills, 38 commands)
| Plugin | Skills | Pattern |
|--------|--------|---------|
| financial-analysis (core) | 11 | Data-source-priority + Excel output + MCP-first |
| investment-banking | varies | CIM drafting + merger models + deal tracking |
| equity-research | varies | Earnings updates + coverage reports + screening |
| private-equity | varies | Deal sourcing + DD checklists + IC memos |
| wealth-management | varies | Client prep + financial plans + portfolio rebalancing |

Key patterns from financial-services:
- **Core + add-on architecture**: financial-analysis is required first, others extend it
- **Data source priority**: MCP sources > institutional sources > web search
- **Excel/PowerPoint output**: structured financial models as real spreadsheets
- **Commands alongside skills**: `/comps`, `/dcf`, `/earnings` for explicit invocation
- **hooks.json**: empty array `[]` when hooks are reserved but unused
