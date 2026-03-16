# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Skill Builder Skill (`/skill-magic`)
**Your primary build tool.** Invoke via `/skill-magic` for the full skill lifecycle:
- **Phase 1 — Create:** Interview → write SKILL.md → draft test cases
- **Phase 2 — Test:** Run trigger tests, verify output, show pass/fail table
- **Phase 3 — Improve:** Root-cause failures, iterate, checkpoint scores
- **Description Optimization:** Tune trigger phrases for reliable firing

Use this for EVERY skill you build. Do not manually author SKILL.md files from scratch — the skill-builder skill enforces quality gates (test cases, progressive disclosure, anti-rationalization tables) that you will skip if you go freehand.

Quick mode (`/skill-magic` with "quick" in the prompt) is acceptable for simple, single-purpose skills. Full mode for anything with multiple phases or complex trigger conditions.

## File System Tools
Read and write files in the project workspace:
- Read source files, existing skills, and reference materials
- Write SKILL.md and example code files
- Navigate the skills directory structure

## Web Search & WebFetch
Research skill topics before building:
- Search for official docs, API references, community patterns
- Fetch primary sources to understand the problem space
- Verify your skill's approach against current best practices

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- A skill is not done until it has been tested via `/skill-magic` Phase 2.
- Do NOT skip the test phase. Every skill gets at least 3 trigger tests and 2 output tests before marking done.
