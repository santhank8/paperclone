# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Next.js Tooling
Build and develop the website:
- `bun run dev` for local development
- `bun run build` to verify production build — run before marking any task done
- `bun run typecheck` for TypeScript validation
- `bun run lint` for code quality checks

## Component Library
Use shadcn/ui + Radix for all UI components:
- Check `components/ui/` for existing primitives before building new ones
- Add new shadcn components via `bunx --bun shadcn@latest add <component>`
- Use Tailwind CSS with mobile-first breakpoints (`md:`, `lg:`)
- Use CSS variables from the theme for all colors

## Vercel CLI
Deploy to preview and production environments:
- `vercel` for preview deployments
- `vercel --prod` for production (requires explicit task instruction)
- Always comment the preview URL on the issue after deploying

## Browser Testing (Chrome CDP)
Verify UI behavior and responsiveness:
- Test at 375px (mobile), 768px (tablet), 1280px (desktop)
- Check interactive elements: hover states, focus rings, click targets
- Verify accessibility: keyboard navigation, ARIA labels
- Take screenshots as evidence for review comments

## Git & GitHub (`gh` CLI)
- Use `gh` CLI for all GitHub operations
- Create PRs with `gh pr create`, never push directly to main
- Reference Paperclip issue identifiers in PR descriptions

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- `bun run build` must pass before any task is marked done. No exceptions.
- Production deploys require explicit instruction — default to preview.
- Server Components by default. Only add `"use client"` when you need hooks, events, or browser APIs.
