# The Lessons File — Structure and Maintenance

## Purpose

`lessons-learned.md` is the institutional memory for your agent's failure patterns. It captures recurring violations, tracks frequency, and documents the rule state at time of violation — so rule refinement has data to work from.

This is NOT a diary. It's a pattern registry.

## Location

```
~/.claude/lessons-learned.md     # global, all projects
[project]/.claude/lessons-learned.md  # project-specific (preferred)
```

## Entry Format

```markdown
## [violation-type] — [date first seen]
- **Frequency:** N in last M sessions
- **Example:** [exact command or behavior that triggered the violation]
- **Rule at time:** "[exact text of the CLAUDE.md rule that was violated]"
- **Root cause hypothesis:** [why the rule isn't being followed]
- **Status:** active | resolved | monitoring
```

### Full Example

```markdown
## bash_instead_of_glob — 2026-03-10
- **Frequency:** 5 in last 8 sessions
- **Example:** Ran `ls -la components/` instead of Glob("components/**")
- **Rule at time:** "Use Glob for file discovery — not ls, find, or stat"
- **Root cause hypothesis:** Rule says what NOT to do but doesn't give the immediate Glob alternative. Agent defaults to familiar Bash.
- **Status:** active

## grep_not_grep_tool — 2026-03-11
- **Frequency:** 3 in last 5 sessions
- **Example:** Used `grep -r "useState" .` in Bash instead of Grep tool
- **Rule at time:** "Search file contents with Grep tool"
- **Root cause hypothesis:** Rule is in a different section of CLAUDE.md from where grep is naturally considered. Proximity matters.
- **Status:** active

## cat_instead_of_read — 2026-03-12
- **Frequency:** 2 in last 3 sessions
- **Example:** Used `cat file.ts | head -30` instead of Read(file_path, limit=30)
- **Rule at time:** "Use Read tool — never cat/head/tail in Bash"
- **Root cause hypothesis:** Rule exists but the anti-rationalization reminder ("This triggers a rule violation") is not prominent enough.
- **Status:** monitoring
```

## When to Create an Entry

**Threshold: 2+ occurrences across distinct sessions.**

- Session 1: violation fires → log it in violations.jsonl only
- Session 2: same violation type fires again → promote to lessons-learned.md
- Session 5+: same pattern → update Frequency count, refine root cause

**Never create an entry from a single occurrence.** n=1 is noise.

## Dedup Logic

Before creating a new entry, search the file:

```bash
grep -l "bash_instead_of_glob" ~/.claude/lessons-learned.md
```

If found → update the existing entry's Frequency and date. Never duplicate.

## Updating an Existing Entry

When the same violation recurs:
1. Increment Frequency count
2. Update the Example if the new instance is more illustrative
3. Revise Root cause hypothesis if you have more insight
4. Leave Status as `active` until you've run a successful keep/discard loop on the fix

## Resolving an Entry

After a successful rule update that eliminates the violation:
1. Set `Status: resolved — [date]`
2. Add: `**Fixed by:** "[new rule text]"`
3. Keep the entry — resolved patterns are reference material, not clutter

## Pruning Schedule

Quarterly review:
- Archive `resolved` entries older than 6 months to `lessons-learned-archive.md`
- Delete `monitoring` entries with zero recurrence for 90 days
- Never delete `active` entries

## File Header Template

```markdown
# Agent Lessons Learned

Last updated: [date]
Active violations: [count]
Resolved this quarter: [count]

---
```

## Integration With Hooks

The Stop hook (see 05-session-end-summary.md) should:
1. Read `violations.jsonl` for current session
2. Cross-reference with `lessons-learned.md`
3. Auto-increment Frequency for existing entries
4. Flag new patterns for manual review (don't auto-create entries — human review first)
