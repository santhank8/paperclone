## Optimization 2026-03-17 — 8/8 kept

**What improved:** 168→94 lines (-44%), all scores held at 27/27 (100%) throughout.

**Changes kept:**
1. Remove Reference Index table — inline `→` pointers satisfy O9, table is pure navigation overhead (-12 lines)
2. Remove "Why One-Shot WebFetch Fails" section — intro covers it, detection signal already in Anti-Hallucination Hooks (-10 lines)
3. Collapse Quick Setup JSON block to one-liner — full JSON lives in reference file (-21 lines)
4. Collapse Structured Output Contract code block — O4 says "Includes OR references", pointer satisfies it (-18 lines)
5. Collapse source hierarchy numbered list to inline text — O8 requires the distinction, not a specific format (-5 lines)
6. Trim anti-rationalization 6→4 entries — training data and exploratory entries implied elsewhere (-2 lines)
7. Collapse Progressive Deepening 3-step list to one sentence (-4 lines)
8. Collapse Research Agent Pattern when-to-use bullets to one sentence (-2 lines)

**Pattern:** Inline code blocks duplicating reference files are the biggest dead weight (Quick Setup JSON = 21 lines, Output Contract schema = 18 lines). The OR in "Includes OR references" is the key — pointer always sufficient.

**Pattern:** Numbered lists and bullet pairs collapse to inline sequences with zero score impact. Lists add visual weight that isn't tested.

**Pattern:** Anti-rationalization entries covering the same failure mode as other sections (training data cutoff ≈ hallucination framing throughout) are safe to cut.

---

## QC Review 2026-03-17 — PASS

**What worked well:**
- PostToolUse hook + SessionStart hook pattern (source-log.md) is the key differentiator — makes hallucination detection explicit and verifiable
- Complaint-phrasing triggers ("Claude invents sources", "can't trust Claude's research") catch the real pain point, not just the methodology name
- NOT-for exclusions for #006 (MCP setup) and #013 (debugging) prevent false fires on adjacent topics despite keyword overlap
- Reference files are all substantive with working code examples (bash hooks, AGENTS.md config, prompt templates)
- Anti-rationalization table addresses the most common mistake: "one source is enough"
- 27/27 test score (100% across trigger/no-fire/output) from day one — no QC fixes needed

**Near misses:**
- None. This is a well-built skill.

**Pattern for next skills:**
- Use PostToolUse/SessionStart hooks as the native-only differentiator — they're what make a skill defensible against connector/API competitors
- Complaint phrasing + NOT-for exclusions = strong false-positive prevention
- 6-entry anti-rationalization table is the sweet spot (not too long, covers most rationalizations)
