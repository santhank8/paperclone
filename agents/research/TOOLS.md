# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Web Search
Use to discover recent developments, releases, community discussions, and news. Prefer searches with date filters when recency matters.

## WebFetch
Use to read primary sources: official documentation, GitHub releases, changelogs, product pages. Do not rely on summaries when the source is available.

## YouTube Research Skill (`/youtube-research`)
Use for video topic research when CEO assigns YouTube content tasks:
- Competitor analysis via YouTube Data API (search videos, fetch transcripts, get metrics)
- Content gap identification with opportunity ratings
- Produces structured research docs at `./youtube/episodes/[topic-slug]/research.md`

This skill uses the `youtube` MCP server tools (`mcp__youtube__search_videos`, etc.) to pull real data. Use it instead of manual web searching for YouTube-specific research.

## File System Tools
Write research findings and Skill Briefs to local files:
- Store notes in `$AGENT_HOME/notes/` with descriptive filenames and dates
- Store Skill Briefs in issue comments AND as local files for SkillBuilder reference
- Read existing skills in `skills/` to avoid duplicating what's already built

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- WebFetch returns raw content — parse carefully and cite the URL in your Skill Brief.
- Do not use WebFetch to scrape paywalled content.
- Always check `skills/` directory before proposing a new skill — don't brief what's already built.
