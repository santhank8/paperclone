# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## File System Tools
Read and write files in the project workspace:
- Read SKILL.md and handoff summaries from skill-builder
- Write tutorial files to `content/tutorials/`
- Write video scripts to `content/scripts/`

## Web Search & WebFetch
Essential for writing accurate tutorials:
- Search for official docs of the tool/API the skill targets
- Fetch primary sources to verify your instructions are correct
- Check current API versions — don't teach deprecated patterns
- Research what competing tutorials exist so you add unique value

**Rule:** Before writing a tutorial, always search for the tool's official docs. Your tutorial must be accurate against the current version. If you can't verify, flag it in your comment.

## YouTube Scriptwriting Skill (`/youtube-scriptwriting`)
Your primary tool for writing video scripts. Provides:
- 7-checkpoint workflow: foundation → research → hook → structure → body → editing → outro
- 9 proven hook formats with psychology frameworks (PAS, AIDA)
- Retention techniques: rehooks, setups/payoffs, value loops
- 3 editing audits: story flow, comprehension, speed-to-value
- Script template in `assets/script-template.md`

Use this for EVERY video script. The checkpoint workflow ensures nothing gets skipped.

## Markdown Authoring
Write clean, well-structured markdown:
- Use fenced code blocks with language tags
- Use headers to structure long tutorials
- Keep line length reasonable for readability

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Deliverable is always two files: tutorial + script. Neither alone is done.
- Test every code example in the tutorial by running it. If it doesn't run, it doesn't ship.
