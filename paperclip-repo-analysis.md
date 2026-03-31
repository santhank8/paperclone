# Paperclip Repository: Comprehensive Analysis

## Executive Summary

Paperclip is an orchestration platform for autonomous AI agent companies. It provides a modular ecosystem for:
1. **Skills** — reusable agent capabilities (release-changelog, pr-report, doc-maintenance, company-creator, create-agent-adapter, release coordination)
2. **Adapters** — bridges between Paperclip's orchestration and specific AI runtimes (Claude Code, Codex, Gemini, Cursor, OpenClaw, etc.)
3. **Agent Companies** — portable YAML/markdown packages defining organizations of agents with structured reporting, workflows, and projects

This document maps the codebase architecture with emphasis on integration complexity, dependencies, and extension points.

---

## 1. Skills Directory (.agents/skills/)

### Overview

Six production skills live in `.agents/skills/` as the primary extension point for agent work. Each is a standalone `SKILL.md` with detailed execution protocols.

### 1.1 release-changelog Skill (192 lines)

**Purpose**: Generate user-facing stable release changelogs by reading commits, changesets, and PR context since the last stable tag.

**Key Characteristics**:
- **Versioning Model**: Calendar versioning (calver): `YYYY.MDD.P` for stable, `YYYY.MDD.P-canary.N` for canary
- **Idempotency**: Checks if `releases/vYYYY.MDD.P.md` exists; asks before overwriting
- **Data Sources**:
  - Git commits and tags: `git log v{last}..HEAD --oneline --no-merges`
  - Changesets: `.changeset/*.md` files
  - Merged PRs: `gh pr list --state merged --search "merged:>={date}"`
- **Breaking Change Detection**: Scans for `BREAKING:`, `BREAKING CHANGE:`, or `!:` prefixes
- **Output Format**: Sections include Breaking Changes, Highlights, Improvements, Fixes, Upgrade Guide, Contributors

**Integration Complexity**: Medium
- Requires git, GitHub CLI (`gh`), and changelog understanding
- Minimal dependencies on other systems
- Can run independently

---

### 1.2 pr-report Skill (202 lines)

**Purpose**: Review PRs/contributions deeply and produce maintainer-grade analysis reports (HTML, Markdown).

**Workflow**:
1. Acquire target (local code, diff size, related docs)
2. Build mental model of system changes
3. Review like a maintainer (findings ordered by severity)
4. Distinguish objection type (product, architecture, implementation, rollout, docs)
5. Compare to external precedents
6. Make actionable recommendation
7. Build HTML/Markdown artifact with visual hierarchy
8. Verify artifact exists and findings match code

**Review Heuristics**:
- Plugin/platform work: watch for trust model violations
- Good signs: typed contracts, explicit extension points, host-owned lifecycle
- Bad signs: module-global state, hidden render dependencies, plugins reaching into internals

**Integration Complexity**: High
- Requires deep codebase reading, context window management
- Manual architectural judgment needed
- Produces complex artifacts (HTML or structured Markdown)
- Inherently unpredictable review depth

---

### 1.3 create-agent-adapter Skill (718 lines) — **MOST DETAILED**

**Purpose**: Technical guide for creating new Paperclip adapter packages.

**Architecture Overview**:
```
packages/adapters/<name>/
  src/
    index.ts            # Shared metadata
    server/
      execute.ts        # Core execution
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui/
      parse-stdout.ts   # Transcript parsing
      build-config.ts   # Configuration UI
    cli/
      format-event.ts   # Terminal output
```

**Core Interfaces**:
- `AdapterExecutionContext` — Input to execute()
- `AdapterExecutionResult` — Output from execute()
- `AdapterSessionCodec` — Session serialization
- `ServerAdapterModule` — Server-side registry
- `UIAdapterModule` — Client-side registry
- `CLIAdapterModule` — CLI registry

**Environment Variables Injected by Server**:
```
PAPERCLIP_AGENT_ID, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_URL, PAPERCLIP_RUN_ID
PAPERCLIP_TASK_ID, PAPERCLIP_WAKE_REASON, PAPERCLIP_WAKE_COMMENT_ID
PAPERCLIP_APPROVAL_ID, PAPERCLIP_APPROVAL_STATUS, PAPERCLIP_LINKED_ISSUE_IDS
PAPERCLIP_API_KEY
```

**Integration Complexity**: Very High
- 718-line specification with three consumer layers
- Session management and output parsing context-dependent per runtime
- Skills injection requires knowledge of target agent CLI/SDK
- Security considerations critical

---

### 1.4 doc-maintenance Skill (201 lines)

**Purpose**: Audit top-level documentation (README, SPEC, PRODUCT) for drift against recent git history.

**Workflow**:
1. Detect changes: Read last-reviewed commit SHA from `.doc-review-cursor`
2. Classify changes: Feature, Breaking, Structural
3. Build summary: Categorize into human-readable list
4. Audit docs: Check for false negatives (shipped but undocumented) and false positives
5. Apply minimal edits: Fix only inaccuracies; preserve voice
6. Open PR: Commit changes + update cursor

**Target Documents**:
- `README.md` — features table, roadmap, quickstart
- `doc/SPEC.md` — schema/model accuracy
- `doc/PRODUCT.md` — core concepts and feature list

**Integration Complexity**: Medium
- Git log parsing and commit classification
- File comparison and drift detection
- Produces PR via GitHub CLI

---

### 1.5 company-creator Skill (269 lines)

**Purpose**: Create agent company packages conforming to Agent Companies specification (agentcompanies/v1).

**Two Modes**:

**Mode 1: Company From Scratch**
- Interview user about company purpose, agents, workflow pattern
- Propose hiring plan (typically 3-5 agents)

**Mode 2: Company From Repo**
- Analyze repo structure, identify existing skills and agents
- Propose company structure wrapping the repo

**Package Structure**:
```
<company-slug>/
├── COMPANY.md
├── agents/<slug>/AGENTS.md
├── teams/<slug>/TEAM.md
├── projects/<slug>/PROJECT.md
├── tasks/<slug>/TASK.md
├── skills/<slug>/SKILL.md
├── README.md
├── LICENSE
└── .paperclip.yaml
```

**Integration Complexity**: Very High
- Two distinct workflows (from-scratch vs. from-repo)
- Requires interview loop with user
- Spec compliance checking
- Company package generation across multiple files

---

### 1.6 release Skill (247 lines)

**Purpose**: Coordinate full Paperclip release workflow (changelog, canary verification, smoke testing, stable promotion).

**Release Model**:
- Every push to `master` publishes a canary automatically
- Canaries use `YYYY.MDD.P-canary.N` versioning
- Stable releases use `YYYY.MDD.P` (manual promotion)

**Critical Rules**:
- Do NOT use release branches as default path
- Do NOT derive major/minor/patch bumps
- Do NOT create canary changelog files
- Do NOT create canary GitHub Releases

**Steps**:
1. Choose Candidate (canary or stable)
2. Draft Stable Changelog (invoke release-changelog skill)
3. Verify Candidate SHA (run gate: typecheck, test, build)
4. Validate Canary (check verification passed, npm publish succeeded)
5. Smoke Test (run Docker smoke tests)
6. Preview or Publish Stable
7. Finish Other Surfaces (website, social, announcements)

**Integration Complexity**: High
- Orchestrates multiple external systems
- Depends on release-changelog skill
- Requires human decision points
- Handles failure recovery and rollback

---

## 2. Adapter Architecture

### Adapter Landscape

| Adapter | Type Key | LOC (server/) | Complexity | Runtime |
|---------|----------|---------------|-----------|---------|
| claude-local | `claude_local` | 1,728 | High | Claude Code CLI |
| codex-local | `codex_local` | 1,735 | High | OpenAI Codex CLI |
| openclaw-gateway | `openclaw_gateway` | 1,785 | Very High | OpenClaw HTTP API |
| cursor-local | `cursor` | 1,113 | High | Cursor background mode |
| opencode-local | `opencode_local` | 1,123 | High | OpenCode CLI |
| pi-local | `pi_local` | 1,102 | High | Embedded Pi agent |
| gemini-local | `gemini_local` | 1,074 | High | Gemini CLI |
| process | `process` | ~300 | Low | Shell commands |
| http | `http` | ~300 | Low | Webhook endpoints |

**Total Server LOC**: ~10,630 across all adapters

### Adapter Registration Points

**Server Registry** (`server/src/adapters/registry.ts`):
- Imports from each adapter package
- Maps type key → `ServerAdapterModule`

**UI Registry** (`ui/src/adapters/registry.ts`):
- Imports from each adapter package
- Maps type key → `UIAdapterModule`

**CLI Registry** (`cli/src/adapters/registry.ts`):
- Imports from each adapter package
- Maps type key → `CLIAdapterModule`

### Key Implementation Patterns

**Session Management Pattern**:
```ts
const canResumeSession =
  runtimeSessionId.length > 0 &&
  (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
const sessionId = canResumeSession ? runtimeSessionId : null;

// If resume failed with unknown session, retry fresh
if (sessionId && !proc.timedOut && exitCode !== 0 && isUnknownSessionError(output)) {
  const retry = await runAttempt(null);
  return toResult(retry, { clearSessionOnMissingSession: true });
}
```

**Skills Injection Pattern** (claude-local):
```ts
async function buildSkillsDir(config: Record<string, unknown>): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-skills-"));
  const target = path.join(tmp, ".claude", "skills");
  const availableEntries = await readPaperclipRuntimeSkillEntries(config);
  const desiredNames = new Set(resolveDesiredSkillNames(config, availableEntries));
  for (const entry of availableEntries) {
    if (!desiredNames.has(entry.key)) continue;
    await fs.symlink(entry.source, path.join(target, entry.runtimeName));
  }
  return tmp;
}
```

**Output Parsing** (defensive):
- Use `parseJson()` for safe JSON extraction
- Use `asString()`, `asNumber()` for type coercion with fallbacks
- Never execute or eval agent output
- Detect known error patterns
- Extract usage, cost, session state separately

---

## 3. Agent Companies Configuration

### Agent Companies Specification (agentcompanies/v1)

**Core Principles**:
1. Markdown is canonical
2. Git repos are valid package containers
3. Registries are optional discovery layers, not authorities
4. SKILL.md owned by Agent Skills spec
5. External references pinnable to immutable Git commits
6. Attribution and license metadata must survive import/export
7. Slugs and relative paths are portable identity

**Package Kinds**:
- `COMPANY.md` — whole company
- `TEAM.md` — organizational subtree
- `AGENTS.md` — individual agent
- `PROJECT.md` — project definition
- `TASK.md` — task definition
- `SKILL.md` — skill (from Agent Skills spec)

**Common Frontmatter**:
```yaml
schema: agentcompanies/v1
kind: company | team | agent | project | task
slug: url-safe-slug
name: Human Readable Name
description: Short description
version: 0.1.0
license: MIT
authors:
  - name: Author Name
homepage: https://example.com
tags: [tag1, tag2]
metadata: {}
sources: []
```

---

## 4. Example: Sprint Co

**File**: `/Volumes/JS-DEV/paperclip/docs/companies/sprint-co/COMPANY.md`

**Company Description**:
- Autonomous AI software company delivering complete, shippable software in 3-hour sprint sessions
- Powered by Anthropic's Planner-Generator-Evaluator architecture

**Team Structure**:
```
Sprint Orchestrator (CEO)
├── Product Team
│   └── Product Planner
├── Engineering Team
│   ├── Sprint Lead
│   ├── Engineer Alpha (full-stack)
│   └── Engineer Beta (backend)
└── QA & Delivery Team
    ├── QA Engineer
    └── Delivery Engineer
```

**3-Hour Sprint Phases**:
| Phase | Duration | Owner | Output |
|-------|----------|-------|--------|
| Planning | 0:00–0:20 | Product Planner | `sprint-plan.md` |
| Architecture | 0:20–0:40 | Sprint Lead | `task-breakdown.md` |
| Implementation | 0:40–2:20 | Alpha + Beta | Feature branches |
| QA/Eval | 2:20–2:45 | QA Engineer | `eval-report.md` |
| Deployment | 2:45–3:00 | Delivery Engineer | Live URL |

---

## 5. Integration Complexity Assessment

### Skill Integration Complexity Summary

| Skill | Complexity | Dependencies | External Systems |
|-------|-----------|--------------|-----------------|
| release-changelog | **Medium** | git, GitHub CLI | GitHub API |
| pr-report | **High** | LLM context, architecture reasoning | None |
| create-agent-adapter | **Very High** | Adapter utils, TypeScript | None (spec) |
| doc-maintenance | **Medium** | git log parsing, file diffing | GitHub CLI |
| company-creator | **Very High** | User interview loop, YAML validation | GitHub |
| release | **High** | release-changelog, Docker, npm, GitHub Actions | npm, GitHub, Docker |

### Adapter Integration Complexity Summary

**High-Complexity** (1,400+ LOC):
- `openclaw-gateway` (1,785): Remote HTTP protocol
- `codex-local` (1,735): Managed CODEX_HOME, stdin-based prompts
- `claude-local` (1,728): Workspace strategies, reasoning effort, quota tracking

**Medium-Complexity** (1,000–1,400 LOC):
- `cursor-local` (1,113), `opencode-local` (1,123), `pi-local` (1,102), `gemini-local` (1,074)

---

## 6. Security & Trust Model

### Secret Injection Pattern

**Rule**: Never put secrets in prompts or config fields
**Pattern**: Inject secrets as environment variables only
- `PAPERCLIP_API_KEY` injected by server (not prompt)
- User-provided secrets in `config.env` as env vars
- `redactEnvForLogs()` masks keys matching `/(key|token|secret|password|authorization|cookie)/i`

### Output Parsing Trust Boundary

Agent output treated as untrusted:
- Safe type extractors (`asString()`, `asNumber()`, `parseJson()`) used throughout
- Never execute or eval agent output
- Detect known error patterns
- Extract usage, cost, session state separately

---

## 7. Extension Points

### Skills
Add new agent capabilities by creating `.agents/skills/<name>/SKILL.md` with:
- Frontmatter (name, description)
- Step-by-step execution protocol (6+ steps typical)
- Input/output specification
- Example commands/snippets
- Reference documents if complex

### Adapters
Create new agent runtime bridges by implementing:
- `packages/adapters/<name>/src/server/` (execution + parsing)
- `packages/adapters/<name>/src/ui/` (transcript + config)
- `packages/adapters/<name>/src/cli/` (formatting)
- Registration in three registries

### Agent Companies
Define new organizations by writing:
- `COMPANY.md` with schema (agentcompanies/v1)
- `agents/<slug>/AGENTS.md` for each agent
- Optional `teams/`, `projects/`, `tasks/` subdirectories
- `.paperclip.yaml` for adapter/env overrides
- `README.md` and `LICENSE`

---

## 8. Key Design Principles

1. **Markdown-First**: Configuration and documentation use markdown with YAML frontmatter
2. **Spec-Driven**: Agent Companies and adapters follow explicit specifications
3. **Modular Skills**: Reusable agent capabilities with clear execution protocols
4. **Three-Layer Adapters**: Server (execution), UI (transcript), CLI (formatting) separation
5. **Stateless Execution**: Adapters are functions (context → result); session state is opaque
6. **Defensive Parsing**: Agent output treated as untrusted; safe type extractors throughout
7. **Zero Contamination**: Skills injected via symlinks, never into agent's working directory
8. **Explicit Trust Boundaries**: Session codec, env var injection, and output parsing are documented
9. **Workflow Context**: Agents understand their role in organization

---

**This analysis provides the foundation for integrating Paperclip's skills and capabilities into your sprint-co setup.**
