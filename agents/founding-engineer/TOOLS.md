# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Para-Memory-Files Skill
File-based memory system using PARA method for knowledge persistence.

## Development Tools
Full-stack development capabilities:
- **Runtime:** `bun` for all JS/TS operations (run, test, install)
- **Build:** `bun run build`, `bun run typecheck`, `bun run lint`
- **Git:** Version control, branching, PRs via `gh` CLI
- **Deploy:** Vercel CLI for preview and production deployments

## Web Search & WebFetch
Research before building:
- Search for library docs, API references, best practices
- Fetch official documentation for unfamiliar tools
- Check for existing solutions before building from scratch

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Use `bun`, not npm/yarn/npx.
- Use `gh` CLI for all GitHub operations — never raw URLs.
- `bun run build` must pass before marking any engineering task done.
