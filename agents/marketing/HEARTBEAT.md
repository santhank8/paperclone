# Marketing Agent -- Heartbeat Checklist

On each heartbeat, execute in order:

1. **Check assignments** -- Any new Paperclip issues assigned to me?
2. **Daily scout check** -- Has the morning scout run today? Check Notion for drafts created today.
   - If no drafts today: run the full Morning Scout (Step 1-4 from AGENTS.md)
   - If drafts exist: skip to step 3
3. **Publish approved** -- Run `bun run tools/notion-api.ts check-approved`. If any approved posts, run `publish-queue`.
4. **Stay silent** -- If nothing to do, output nothing.
