# Rule Refinement — Updating CLAUDE.md From Violation Data

## The Core Workflow

1. Pull top 3 violations from `lessons-learned.md` (by Frequency)
2. For each: run the rule test
3. Diagnose failure mode
4. Rewrite the rule
5. Verify with keep/discard loop (see 04-keep-discard-loop.md)

## The Rule Test

Read the current rule cold — pretend you've never seen it. Ask: do you immediately know exactly what to do?

**Pass:** "Use Glob for file discovery — never ls, find, or stat in Bash. Glob is faster and doesn't trigger violations."
→ Clear. Specific. Tells you the alternative. Explains why.

**Fail:** "Prefer native tools when available."
→ Which tools? Available for what? Against what? Unactionable.

**Fail:** "Use proper file search methods."
→ "Proper" is undefined. Fails immediately.

If ambiguous → the rule fails, regardless of how long it's been in CLAUDE.md.

## Failure Mode Diagnosis

| Failure Mode | Symptoms | Fix |
|---|---|---|
| **Too vague** | Rule mentions concept, not behavior | Add specific tool names, exact command to use |
| **No alternative given** | Rule says what NOT to do, not what TO do | Add "Instead: [specific tool/pattern]" |
| **Proximity miss** | Rule is in a different section from where the decision is made | Move rule to the section where it's relevant, or add a pointer |
| **No enforcement signal** | Rule exists but nothing marks violations | Add anti-rationalization line: "Thinking 'I'll just X'? No." |
| **Too long** | Rule buried in a paragraph | Extract to a table row or bulleted line |
| **Scope mismatch** | Rule says "always" but has valid exceptions | Add "except: [specific case]" |

## Before/After Examples

### Example 1: Too Vague → Specific

**Before:**
> Use native search tools when possible.

**After:**
> **Glob for file discovery** — NEVER use `ls`, `find`, or `stat` in Bash. Glob is faster, cleaner, and doesn't trigger violations.
> Thinking "I'll just ls to find the file..."? `Glob("**/*.ts")`. Done.

What changed: named the tool, named the forbidden commands, added the anti-rationalization line.

### Example 2: Missing Alternative → Alternative Given

**Before:**
> Don't use grep in Bash for code search.

**After:**
> **Content search → Grep tool** — NEVER `grep` or `rg` in Bash. Use `Grep(pattern, path)`.
> - Thinking "I'll grep for it"? LSP is faster and semantic. Try LSP first.
> - Thinking "LSP won't work here"? Then use the Grep tool. Never `grep` in Bash.

What changed: told them the exact tool to use, included the LSP-first preference.

### Example 3: Proximity Miss → Co-location

**Before:** Rule was buried in a "Code Quality" section at the bottom.

**After:** Rule moved to the "Tool Selection" section, directly above the first place Bash is mentioned.

---

## CLAUDE.md Update Protocol

1. **Never edit mid-session.** Wait for session end to apply changes — active sessions don't reload CLAUDE.md.
2. **One rule at a time.** Change one rule per keep/discard iteration. Changing two makes it impossible to attribute score changes.
3. **Preserve structure.** Don't reorganize sections during a fix. Change the rule text only.
4. **Document the change.** After each rule update, add a line at the bottom of the rule:
   ```
   Auto-updated [date] ([N] consecutive violations).
   ```
   This creates a trail without cluttering the rule itself.

## Rule Quality Checklist

Before committing a rule change:

- [ ] Specifies the exact tool or command to use
- [ ] Names what NOT to use
- [ ] Gives a one-line anti-rationalization ("Thinking 'X'? No. Do Y.")
- [ ] Fits in 3 lines or less (tables allowed)
- [ ] The rule test passes: read cold, immediately actionable

## When Rule Refinement Isn't Enough

If you've refined a rule 3 times and the violation persists, the problem is structural:

| Structural Problem | Solution |
|---|---|
| Rule is in the wrong file | Move it to the file the agent reads first |
| Rule is too far from decision point | Add an inline reminder near the code path |
| Agent isn't reading CLAUDE.md at all | Add hook that loads CLAUDE.md into context at session start |
| Rule conflicts with default behavior | Need an anti-rationalization table entry, not just a rule |
