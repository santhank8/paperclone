# Documentation Agent

> Sprint Co Capability — Phase 11: Advanced Agent Capabilities

## Purpose

Every shipped feature should have user-facing documentation. The Documentation Agent ensures that no feature reaches users without clear, accurate, and complete docs.

## Doc Types

| Doc Type | Audience | Generated When | Format |
|----------|----------|---------------|--------|
| README | Developers / Users | Project init + major changes | Markdown |
| API Docs | Developers | New/changed endpoints | Markdown + OpenAPI |
| Getting Started | New users | First release + major UX changes | Markdown |
| Feature Guides | Users | Every shipped feature | Markdown |
| FAQ | Users | Accumulated from support patterns | Markdown |
| Changelog | All | Every sprint close | Markdown |

## Generation Protocol

For each shipped feature:

```
1. READ inputs
   ├── Handoff artifact from Engineer
   ├── Source code (changed files)
   ├── Test files (for usage examples)
   └── Any existing docs for the area

2. GENERATE user-facing documentation
   ├── What the feature does (plain language)
   ├── How to use it (step-by-step)
   ├── Configuration options (if any)
   ├── Examples (code snippets, screenshots, curl commands)
   └── Limitations / known issues

3. VALIDATE against quality checklist (below)

4. SUBMIT for Stakeholder review
   ├── Attach generated docs to sprint artifacts
   └── Flag any areas needing human review (e.g., marketing copy)

5. PUBLISH after approval
   └── Merge docs into documentation site / README
```

## Doc Quality Checklist

Every generated document must pass this checklist:

| # | Criterion | Description | Required |
|---|-----------|-------------|----------|
| 1 | **Accurate** | Matches current implementation exactly | Yes |
| 2 | **Current** | Reflects latest version, not stale | Yes |
| 3 | **Complete** | Covers all user-facing aspects of the feature | Yes |
| 4 | **Example-rich** | At least one usage example per feature | Yes |
| 5 | **Jargon-free** | Understandable by target audience without internal context | Yes |
| 6 | **Structured** | Uses headings, lists, tables — scannable | Yes |
| 7 | **Tested** | Code examples have been verified to work | Yes |
| 8 | **Cross-referenced** | Links to related docs/features | Recommended |
| 9 | **Accessible** | Alt text for images, clear language | Recommended |
| 10 | **Concise** | No unnecessary padding or filler | Recommended |

**Pass threshold:** All "Required" items must be checked. 2+ "Recommended" items should be checked.

## Doc Generation Template

```markdown
# <Feature Name>

> Added in Sprint <sprint-id> | Version <version>

## Overview

<1-2 sentence plain-language description of what this feature does and why it matters.>

## Getting Started

### Prerequisites
- <prerequisite 1>
- <prerequisite 2>

### Quick Start
<Step-by-step instructions to use the feature for the first time.>

## Usage

### Basic Example
```
<code example>
```

### Configuration Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| ... | ... | ... | ... |

### Advanced Usage
<More complex examples or edge cases.>

## API Reference

<If applicable — endpoints, parameters, response formats.>

## FAQ

**Q: <Common question>**
A: <Answer>

## Limitations

- <Known limitation 1>
- <Known limitation 2>

## Related

- [<Related feature>](<link>)
- [<Related guide>](<link>)
```

## Doc Versioning

Documentation is tied to sprint versions:

| Concept | Rule |
|---------|------|
| Version tag | Docs include the sprint version that introduced the feature |
| Update policy | When a feature changes, docs are updated in the same sprint |
| Deprecation | Deprecated features are marked in docs with migration guides |
| History | Previous versions of docs are preserved in version control |

### Version Header

Every doc file includes:
```markdown
<!-- doc-version: sprint-<id> | last-updated: YYYY-MM-DD | status: current|deprecated -->
```

## Integration with Sprint Lifecycle

The Documentation Agent operates at specific points in the sprint:

```
Sprint Start
  │
  ├── Doc agent reviews existing docs for staleness
  │
Sprint Execution
  │
  ├── Doc agent monitors completed tasks for doc-worthy features
  │
Deploy Complete
  │
  ├── Doc agent generates/updates docs for all shipped features
  ├── Doc quality checklist applied
  ├── Docs submitted for Stakeholder review
  │
Sprint Close
  │
  ├── Changelog auto-generated from sprint artifacts
  ├── Final doc review pass
  └── All docs merged and published
```

## Changelog Auto-Generation

The Documentation Agent produces a changelog entry for every sprint:

```markdown
# Changelog — Sprint <id>

**Date:** <YYYY-MM-DD>
**Version:** <version>

## New Features
- **<Feature name>** — <one-line description> ([docs](<link>))

## Improvements
- <improvement description>

## Bug Fixes
- <bug fix description>

## Breaking Changes
- <breaking change + migration guide link>

## Known Issues
- <known issue description>
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Doc coverage | 100% of shipped features have docs |
| Doc accuracy | 0 reported inaccuracies per sprint |
| Time to doc | <30 min per feature |
| Stakeholder approval rate | >90% first-pass approval |
