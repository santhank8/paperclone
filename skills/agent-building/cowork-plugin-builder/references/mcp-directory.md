# MCP Server Directory

Confirmed working MCP endpoints from the Anthropic marketplace. Check here before searching.

## General Business Tools

| Service | Type | URL |
|---------|------|-----|
| Slack | http | `https://mcp.slack.com/mcp` |
| Notion | http | `https://mcp.notion.com/mcp` |
| Atlassian (Jira/Confluence) | http | `https://mcp.atlassian.com/v1/mcp` |
| Google Calendar | http | `https://gcal.mcp.claude.com/mcp` |
| Gmail | http | `https://gmail.mcp.claude.com/mcp` |
| Microsoft 365 | http | `https://microsoft365.mcp.claude.com/mcp` |
| GitHub | http | `https://api.githubcopilot.com/mcp/` |
| Figma | http | (via marketplace registry) |
| Asana | sse | `https://mcp.asana.com/sse` |
| Linear | sse | `https://mcp.linear.app/sse` |
| Intercom | http | (via marketplace registry) |

## Sales & CRM

| Service | Type | URL |
|---------|------|-----|
| HubSpot | http | `https://mcp.hubspot.com/anthropic` |
| Close | http | `https://mcp.close.com/mcp` |
| Clay | http | `https://api.clay.com/v3/mcp` |
| ZoomInfo | http | `https://mcp.zoominfo.com/mcp` |
| Apollo | http | `https://api.apollo.io/mcp` |
| Outreach | http | `https://mcp.outreach.io/mcp` |
| SimilarWeb | http | `https://mcp.similarweb.com/mcp` |

## Meeting & Transcription

| Service | Type | URL |
|---------|------|-----|
| Fireflies | http | `https://api.fireflies.ai/mcp` |

## Financial Data

| Service | Type | URL |
|---------|------|-----|
| Daloopa | http | (via marketplace registry) |
| PlanetScale | http | (via marketplace registry) |
| Snowflake | http | (via marketplace registry) |
| Databricks | http | (via marketplace registry) |
| BigQuery | http | (via marketplace registry) |

## Content & Design

| Service | Type | URL |
|---------|------|-----|
| Canva | http | (via marketplace registry) |
| Cloudinary | http | (via marketplace registry) |

## Data & Web

| Service | Type | URL |
|---------|------|-----|
| Bright Data | http | (via marketplace registry) |
| Nimble | http | (via marketplace registry) |

## Storage & Databases

| Service | Type | URL |
|---------|------|-----|
| CockroachDB | http | (via marketplace registry) |
| Prisma | http | (via marketplace registry) |

## Category to Common Tools Mapping

Use this when a client mentions a category but not a specific tool:

| Category | Common Tools |
|----------|-------------|
| CRM | HubSpot, Salesforce, Close, Pipedrive, Copper |
| Chat | Slack, Microsoft Teams, Discord |
| Project tracker | Linear, Asana, Jira, Monday, ClickUp |
| Email | Gmail, Microsoft 365 (Outlook) |
| Calendar | Google Calendar, Microsoft 365 |
| Knowledge base | Notion, Confluence, Guru |
| Meeting transcription | Fireflies, Gong, Chorus, Otter.ai |
| Data enrichment | Clay, ZoomInfo, Apollo, Clearbit, Lusha |
| Sales engagement | Outreach, Salesloft, Apollo |
| Source control | GitHub, GitLab, Bitbucket |
| Design | Figma, Canva |
| Data warehouse | Snowflake, Databricks, BigQuery |
| Customer support | Intercom, Zendesk, Freshdesk |
| Analytics | Amplitude, Pendo, Mixpanel |
| SEO | Ahrefs, SimilarWeb, Semrush |
| Email marketing | Klaviyo, Mailchimp, HubSpot |

## Finding New MCP Servers

If a client's tool isn't listed above:

1. Search `{tool-name} MCP server` on the web
2. Check the Anthropic plugin marketplace at `claude.com/plugins`
3. Check `awesome-mcp-servers` repos on GitHub
4. If no MCP server exists, note the gap in the README and suggest the client request one from the vendor
