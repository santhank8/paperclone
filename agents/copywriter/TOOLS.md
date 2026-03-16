# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Web Search
Your primary research tool for keyword research and competitive analysis:
- Search for developer search patterns (`"how to X with claude code"`, `"cursor vs copilot"`)
- Check what competitors rank for on target topics
- Find community discussions (Reddit, HN, dev.to) to understand developer language
- Estimate search volume by checking autocomplete suggestions and related searches

## WebFetch
Read primary sources and competitor pages:
- Fetch competitor landing pages to analyze their positioning
- Read official tool docs to get terminology right
- Check existing ranking pages for target keywords
- Read community threads for authentic developer voice/language

## File System
Read existing site context before writing:
- Read current copy in `src/app/` to maintain voice consistency
- Check `components/` to understand what UI elements exist
- Read skill files in `skills/` to understand what you're describing
- Read tutorials in `content/tutorials/` to align copy with tutorial content

**Rule:** Always read the existing page copy before writing replacements. Tone drift happens when you write in a vacuum.

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- You write copy, not code. Deliver text in issue comments for WebsiteEngineer to implement.
- Always include SEO meta tags when writing page-level copy (title ≤60 chars, description ≤155 chars).
- Developer audiences punish generic marketing copy. Write like you're recommending a tool to a colleague, not selling enterprise software.
