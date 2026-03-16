# Learnings: structured-project-workflow skill

## QC Review 2026-03-16 — PASS

### What Worked Well
- **Test-first approach paid off**: 100% test coverage (25/25) before QC meant zero rework. Comprehensive trigger/no-fire/output assertions caught edge cases upfront.
- **8-reference file structure scales**: Progressive disclosure keeps SKILL.md scannable (76 lines) while delivering depth when users need it. No hub-and-spoke, no stubs — each file is independent and substantive.
- **Tight scope discipline**: Brief explicitly listed Out of Scope (multi-agent #003, worktrees #005, TDD #007, MCP #006). SkillBuilder honored those boundaries. No scope creep, no duplicate skill overlap.
- **Anti-rationalization table is essential**: The 6-entry table teaches *why* developers skip steps (re-explaining, missing acceptance criteria, vague CLAUDE.md). Not just "do this," but "here's why you'll want to skip it and why you shouldn't."
- **Frontmatter exclusions work**: Four explicit NOT-for exclusions in description prevent false positives on adjacent skills. Adversarial tests confirmed no drift.

### Near Misses (Tighten Next Time)
- **N5 no-fire test was weak**: "what is a PRD" with low confidence (70%). A follow-up test like "PRD template for general product management" (no Claude Code mention) would be stronger. Consider bumping all generic no-fire tests to higher confidence ranges.
- **T10 trigger test was borderline**: "CLAUDE.md for project notes" hit at 75% confidence. It *does* trigger, but only because "project notes" + "CLAUDE.md" context narrowed it. If the description had been less workflow-specific, this might have failed. The skill is safe, but the description's narrowness is load-bearing.

### Pattern Recognition
- **Reference file naming matters**: The numbered prefix (01-, 02-, etc.) makes Quick Entry table scannable and implies sequence without saying "read in order." Other skills should copy this pattern.
- **Test log format is reusable**: The structure (Iteration N, Trigger/No-Trigger/Output sections, Confidence levels, Known Limitations) worked cleanly. Recommend standardizing this format across all skills.

### Verdict
No failures. Shipped at 100%. Ready for Optimizer iteration to improve trigger depth or add teaching content.

---

## Optimization 2026-03-16 — 8/8 kept

**What improved:** SKILL.md: 77 → 58 lines (-25%). ~85 lines removed from reference files. All scores held at 100%.

**What worked:**
- Removing inline examples redundant with reference files (TASK.md code block in Core Files) — safe because the ref file is linked
- Cutting sections not covered by any output assertion: Prerequisites, "Why No External Tools", "Minimum Viable CLAUDE.md"
- Trimming hook examples: when two examples teach the same concept, one is sufficient
- Shortening verbose prompt examples without losing semantic content

**Pattern:** Starting from 100% baseline means all gains are simplicity-only. Optimization loop becomes: "what exists that no test validates?" Remove it. SKILL.md-vs-ref duplication is always safe to cut from the SKILL.md side.

**Anti-pattern avoided:** Don't touch trigger phrases at 100% trigger score — zero upside, real downside risk.
