---
name: skill-vetting
description: Use when vetting, auditing, or reviewing a Claude Code skill for security, permissions, or trigger safety before installing. Triggers on: "vet this skill", "audit this skill", "is this skill safe", "check this skill before installing", "skill security review", "hook injection check", "review skill permissions", "skill trust audit", "scan this SKILL.md", "compare skill versions for security", "check if this skill is malicious", "should I trust this skill", "skill permission footprint". NOT for: general code security review, npm/pip auditing, CLAUDE.md auditing, MCP server security, or "how do I install skills."
---

# Skill Security Vetting

A SKILL.md can do anything a shell command can do. Hooks run arbitrary code. Permissions expand your blast radius. Before you trust a skill you didn't write, vet it.

**Modes:** Quick Vet (single skill, 5-layer audit) · Comparison Vet (two versions / upgrade) · Policy Setup (trust tiers)

## Quick Vet

### Layer 1: Trigger Phrase Analysis

Read the `description:` frontmatter. Flag if:
- Trigger is a single word or very generic phrase ("use when writing")
- No NOT-for exclusions present
- Overlaps with your installed skills (mentally scan your skill list)
- Ambiguous intent markers that match unrelated conversations

Red flags: `use when X` with no `NOT for:` anywhere in the description.

See → `references/trigger-analysis.md`

### Layer 2: Hook Command Audit

The highest-risk layer. Hooks run on every tool call. Read PreToolUse, PostToolUse, and Stop hook configs. Flag any:
- `curl` / `wget` to unknown external endpoints
- `rm -rf`, destructive filesystem commands
- Sensitive path reads: `~/.ssh/`, `~/.env`, `.env`, API key files
- Background spawning: `& disown`, `nohup`, `screen`, `tmux`
- Data exfiltration: `| nc`, `| curl`, `| python -c`, eval of dynamic strings

See → `references/hook-audit.md`

### Layer 3: Permission Scope Review

Compare stated skill purpose against requested permissions:

| Skill Type | Max Needed |
|---|---|
| Read-only analysis | No bash permissions |
| File creation | Write: specific paths |
| Git operations | Bash: `git` only |
| Build tools | Bash: specific commands |
| Broad `bash:*` | Red flag — justify or reject |

See → `references/permission-scope.md`

### Layer 4: API Endpoint Verification

Scan SKILL.md body and all reference files for:
- Hardcoded URLs — is this the author's own domain?
- WebFetch calls to unfamiliar endpoints
- Auth patterns that could exfiltrate your API keys (e.g., passing `$ANTHROPIC_API_KEY` in a curl)

### Layer 5: Quality Signals

- `references/test-cases.md` exists with real scenarios?
- Reference files are substantive (>10 lines) vs empty stubs?
- Trigger set is 3-12 phrases? (under 3 = too narrow, over 12 = too broad)
- NOT-for exclusions present?

## Verdict Format

```
VERDICT: [PASS / FAIL / CONDITIONAL]
Source: [url or local]
Trust Tier: [Trusted / Community / Untrusted]

Critical: [specific finding or NONE]
High:     [specific finding or NONE]
Medium:   [specific finding or NONE]
Low:      [specific finding or NONE]

Recommendation: [install / do not install / install after remediation: X]
```

**FAIL** = any Critical finding.
**CONDITIONAL** = High findings with a clear remediation path (e.g., remove a hook, narrow a permission).
**PASS** = No Critical/High findings, or all High findings have documented justification.

## Comparison Vet

For upgrades or PR skill reviews. Run Layers 1-5 on both versions, then:
- Flag any new hooks added in the new version
- Flag any broadened trigger phrases
- Flag any new permissions requested
- Flag any new external URLs

Security can only get worse in an upgrade. Treat any expansion as a finding.

## Policy Setup

Set trust tiers once, apply forever.

| Tier | Source | Audit Depth |
|------|--------|-------------|
| Trusted | Your own skills, reviewed teammates | Layer 5 only (quality check) |
| Community | ClawHub with 1K+ downloads + reviews | Layers 1-5 standard |
| Untrusted | Anonymous GitHub, unknown sources | Layers 1-5 + manual read every hook |

See → `references/trust-tiers.md`

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "It's popular on ClawHub, must be safe" | 110K downloads exist for a skill-vetter because trust-by-popularity fails. Downloads ≠ audited. |
| "I'll just look at SKILL.md, hooks aren't that risky" | Hooks are the only layer that actually runs code. SKILL.md is instructions — hooks are execution. |
| "The skill author seems reputable" | Reputable authors get compromised. Supply chain attacks target popular tools. |
| "I'll vet it after I test it out" | Once installed, it's running on every session. Vet before install, not after. |
| "It's just a read-only analysis skill, low risk" | The least suspicious-looking skills are the best exfiltration vectors. |

