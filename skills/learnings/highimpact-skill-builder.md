## Optimization 2026-03-16 — 8/8 kept

**What improved:**
- Added "quick skill" trigger phrase → fixed T10 miss, 91.7%→100% trigger score
- Removed redundant intro paragraph (Skills compound...) → -5 lines, philosophy implied by description
- Removed inline test result table from Phase 2 → -11 lines (biggest win), fully covered by test.md
- Removed anti-rationalization intro sentence → -2 lines, table is self-explanatory
- Shortened "What Makes High-Impact" item 7 from 3 sentences to 1 → -2 lines
- Removed agents/ and scripts/ from Reference Index → -2 lines, not in published content
- Added schemas.md to Reference Index → +1 line quality fix, file was undocumented
- Removed "Three phases" header line → -3 lines, phase detection table makes it obvious

**What didn't work:** Nothing discarded — every iteration kept.

**Pattern:**
- Inline code examples that duplicate reference files are the biggest dead weight (test result table: -11 lines, safe removal)
- Meta-commentary before tables ("You will find reasons to...") is always redundant — tables are self-explanatory
- Undocumented reference files are a real quality gap to fix during optimization (schemas.md was missing from index)
- For first-time optimization of a skill with no existing test-cases.md: create the fixed evaluation in the paperclip project directory before running iterations; the `schemas.md` reference was already installed but not indexed — a good reminder to audit the Reference Index for completeness
