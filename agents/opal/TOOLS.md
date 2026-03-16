# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Hindsight MCP
Institutional memory and analytics store. Base URL: `http://localhost:8891/mcp/hid/`
- `save_summary` — store findings, patterns, performance data with title/type/concepts
- `search` — query past observations by keyword
- `timeline` — browse observations chronologically
- `get_observations` — fetch specific observation by ID

Use Hindsight to build the company's persistent knowledge. Every significant decision, performance insight, or pattern goes here.

## Web Search & WebFetch
Gather external analytics and benchmarks:
- Fetch YouTube Analytics data if API access is configured (`$YOUTUBE_API_KEY`)
- Search for industry benchmarks to contextualize our metrics
- Fetch competitor content to assess relative performance

## Paperclip Dashboard API
Pull internal metrics directly from Paperclip:
- `GET /api/companies/{companyId}/dashboard` — agent activity, issue throughput, budget usage
- `GET /api/companies/{companyId}/issues?status=done` — completed work for velocity tracking
- Use issue comment threads to assess cycle time (created → done)

## File System Tools
Read deliverables and write reports:
- Read completed skills, tutorials, and scripts to assess production volume
- Write weekly reports to `reports/` directory
- Check `content/videos/` for video output status

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Every report must include a "so what" — data without a recommended action is incomplete.
- Update Hindsight after every significant finding so the institutional memory stays current.
- When data is insufficient for a trend, say so. Don't fabricate patterns from noise.
