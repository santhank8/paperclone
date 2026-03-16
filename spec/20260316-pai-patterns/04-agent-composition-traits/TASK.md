# Step 4: Agent Composition from Traits

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this task.

## Quick Reference
- **Branch:** `feat/pai-patterns-04-traits`
- **Complexity:** M
- **Dependencies:** None
- **Estimated files:** 12-15

## Objective
Create a trait library of composable prompt fragments (expertise, personality, approach) and a composition script that assembles them into complete agent prompts. Replace ad-hoc agent prompt writing with structured trait selection.

## Context from Research
PAI uses `Data/Traits.yaml` + `ComposeAgent.ts` + `DynamicAgent.hbs` (Handlebars templates). Their system is TypeScript-heavy with YAML config and template rendering.

Our adaptation is simpler:
- Traits are **markdown files** (prompt fragments), not YAML
- Composition is a **lightweight Bun script** that concatenates traits + adds structure
- No Handlebars — the composition script reads trait files and produces a complete prompt string
- Output is a ready-to-use agent prompt (can be pasted into AGENTS.md or passed to Agent tool)

**Integration points:**
- Paperclip agent creation: `/paperclip-create-agent` can use traits instead of writing from scratch
- Ad-hoc subagent spawning: CEO composes agents on the fly for specific tasks
- Existing agents: can be decomposed into traits retroactively (not required)

## Prerequisites
- [ ] Understand current agent config format (AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md)

## Implementation

**Read these files first** (in parallel):
- `agents/research/AGENTS.md` — Example agent config (to understand the format)
- `agents/research/SOUL.md` — Example soul/personality
- `agents/ceo/SOUL.md` — Another personality example
- `agents/qc/AGENTS.md` — Another agent config example

### 1. Create Trait Library Structure

```
agents/traits/
├── README.md              ← How to use traits, composition examples
├── expertise/
│   ├── security.md
│   ├── frontend.md
│   ├── backend.md
│   ├── research.md
│   ├── devops.md
│   └── content.md
├── personality/
│   ├── skeptical.md
│   ├── thorough.md
│   ├── creative.md
│   ├── pragmatic.md
│   ├── analytical.md
│   └── bold.md
└── approach/
    ├── systematic.md
    ├── rapid.md
    ├── exploratory.md
    └── iterative.md
```

**Trait file format (example: `expertise/security.md`):**
```markdown
# Security Expert

You have deep expertise in application security, threat modeling, and secure coding practices.

## Domain Knowledge
- OWASP Top 10, CWE catalog, CVE assessment
- Authentication/authorization patterns (OAuth2, JWT, session management)
- Input validation, output encoding, parameterized queries
- Secrets management, key rotation, least privilege
- Supply chain security, dependency auditing

## Behavioral Rules
- Always check for auth/authz gaps before approving code
- Flag hardcoded secrets, even in test files
- Prefer deny-by-default over allow-by-default
- Question every trust boundary crossing
```

**Each trait file is a self-contained prompt fragment** — expertise defines what the agent knows, personality defines how it communicates and makes decisions, approach defines its methodology.

### 2. Write Trait Files

Create 16 trait files across the 3 categories:

**Expertise (6):** security, frontend, backend, research, devops, content
**Personality (6):** skeptical, thorough, creative, pragmatic, analytical, bold
**Approach (4):** systematic, rapid, exploratory, iterative

Each trait file should be 15-30 lines. Enough to meaningfully shape behavior, not so much that it bloats the agent prompt.

### 3. Build Composition Script

Create `scripts/compose-agent.ts`:

```typescript
#!/usr/bin/env bun

/**
 * Compose an agent prompt from trait building blocks.
 *
 * Usage:
 *   bun run scripts/compose-agent.ts --expertise security --personality skeptical --approach systematic
 *   bun run scripts/compose-agent.ts --expertise research,frontend --personality creative --approach exploratory
 *   bun run scripts/compose-agent.ts --list                    # List all available traits
 *   bun run scripts/compose-agent.ts --task "Review this PR"   # Auto-select traits for task
 */
```

**Core logic:**
1. Parse CLI args for `--expertise`, `--personality`, `--approach` (comma-separated for multiple)
2. Read corresponding trait files from `agents/traits/`
3. Compose into a structured prompt:
   ```
   # Agent Identity
   [Combined expertise sections]

   # Communication Style
   [Personality trait content]

   # Working Method
   [Approach trait content]

   # Operational Rules
   - Use LSP over Grep for symbol navigation
   - Use `gh` CLI for GitHub URLs
   - Use bun, not npm
   - Don't narrate, just act
   - Verify tool calls succeeded before claiming completion
   ```
4. Output to stdout (pipe-friendly)

**`--list` flag:** Print available traits grouped by category.
**`--task` flag:** (stretch) Auto-suggest traits based on task description — e.g., "Review this PR for security issues" → security + skeptical + systematic.

### 4. Create README

Write `agents/traits/README.md` explaining:
- What traits are and how they compose
- How to add custom traits
- Example compositions for common use cases:
  - Security reviewer: `--expertise security --personality skeptical --approach systematic`
  - Creative researcher: `--expertise research --personality creative --approach exploratory`
  - Fast implementer: `--expertise backend --personality pragmatic --approach rapid`

## Files to Create/Modify

### Create:
- `agents/traits/README.md` — Usage documentation
- `agents/traits/expertise/security.md`
- `agents/traits/expertise/frontend.md`
- `agents/traits/expertise/backend.md`
- `agents/traits/expertise/research.md`
- `agents/traits/expertise/devops.md`
- `agents/traits/expertise/content.md`
- `agents/traits/personality/skeptical.md`
- `agents/traits/personality/thorough.md`
- `agents/traits/personality/creative.md`
- `agents/traits/personality/pragmatic.md`
- `agents/traits/personality/analytical.md`
- `agents/traits/personality/bold.md`
- `agents/traits/approach/systematic.md`
- `agents/traits/approach/rapid.md`
- `agents/traits/approach/exploratory.md`
- `agents/traits/approach/iterative.md`
- `scripts/compose-agent.ts` — Composition script

## Verification

### Automated Checks
```bash
# Verify trait files exist
ls agents/traits/expertise/*.md | wc -l  # Should be 6
ls agents/traits/personality/*.md | wc -l  # Should be 6
ls agents/traits/approach/*.md | wc -l  # Should be 4

# Verify compose script runs
bun run scripts/compose-agent.ts --list

# Verify composition produces output
bun run scripts/compose-agent.ts --expertise security --personality skeptical --approach systematic | head -5

# Verify multiple expertise works
bun run scripts/compose-agent.ts --expertise security,frontend --personality analytical --approach systematic | head -5

# Verify composed output contains keywords from all input traits
OUTPUT=$(bun run scripts/compose-agent.ts --expertise security --personality skeptical --approach systematic)
echo "$OUTPUT" | grep -qi "security" && echo "PASS: security trait present" || echo "FAIL: security trait missing"
echo "$OUTPUT" | grep -qi "skeptical\|question\|challenge\|doubt" && echo "PASS: skeptical trait present" || echo "FAIL: skeptical trait missing"
echo "$OUTPUT" | grep -qi "systematic\|methodical\|structured\|step" && echo "PASS: systematic trait present" || echo "FAIL: systematic trait missing"

# Verify a second combination
OUTPUT2=$(bun run scripts/compose-agent.ts --expertise research --personality creative --approach exploratory)
echo "$OUTPUT2" | grep -qi "research" && echo "PASS: research trait present" || echo "FAIL: research trait missing"
echo "$OUTPUT2" | grep -qi "creative\|imaginat\|novel\|divergent" && echo "PASS: creative trait present" || echo "FAIL: creative trait missing"
```

### Manual Verification
- [ ] Each trait file is 15-30 lines and reads as a coherent prompt fragment
- [ ] Composed output reads as a natural, coherent agent identity (not a Frankenstein)
- [ ] `--list` output is organized and useful
- [ ] README has clear examples that work

## Success Criteria
- [ ] 16 trait files created (6 expertise + 6 personality + 4 approach)
- [ ] compose-agent.ts runs and produces valid agent prompts
- [ ] Multiple traits per category supported (comma-separated)
- [ ] Output is immediately usable as an Agent tool prompt
- [ ] README documents the system with examples

## Scope Boundaries
**Do:** Create traits, build composition script, write documentation
**Don't:** Decompose existing agents into traits. Don't integrate with Paperclip API (that's a follow-up). Don't add voice/prosody settings. Don't build a trait editor UI.

## Escape Route Closure
- "We should decompose existing agents into traits right now" → Not this step. Existing agents work. New agents benefit from traits. Migration is optional and separate.
- "The --task auto-select feature needs ML/embeddings" → No. Simple keyword matching on the task description → trait descriptions is enough. If it doesn't work well, drop the feature.
- "Traits need version numbers" → No. They're markdown files in git. Git IS the version system.
