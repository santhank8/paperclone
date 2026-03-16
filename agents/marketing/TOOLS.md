# Marketing Agent -- Tools

## X/Twitter API (original posts only)
- `bun run tools/x-api.ts post "text"` -- Post a tweet
- `bun run tools/x-api.ts verify` -- Check credentials
- `bun run tools/x-api.ts delete <id>` -- Delete a tweet

## X/Twitter Replies (Claude in Chrome)
- Replies MUST use Claude in Chrome, not the API (API returns 403 on replies)
- Agent MUST be spawned with `--chrome` flag
- Full workflow documented in `CHROME-REPLY.md`
- Key sequence: navigate to tweet, read_page for textbox ref, click ref, type, click Reply

## Notion (Approval Queue)
- `bun run tools/notion-api.ts draft <X|Reddit> <skill> "text" [--reply-to <url>]` -- Create a draft
- `bun run tools/notion-api.ts check-approved` -- Get posts approved by CEO
- `bun run tools/notion-api.ts publish-queue` -- Post all approved original posts with 3-7 min spacing
- `bun run tools/notion-api.ts update <page_id> "new text"` -- Edit a draft
- `bun run tools/notion-api.ts mark-posted <page_id> <url>` -- Mark as published
- `bun run tools/notion-api.ts list` -- Show all posts and statuses

## Grok API (X/Twitter + Web Search)
```bash
curl -s https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "grok-4-fast-non-reasoning", "input": [...], "tools": [{"type": "web_search"}]}'
```

## Reddit (DISABLED -- API access denied)
- Manual posting for now. Draft Reddit posts in Notion, CEO copy-pastes.

## Paperclip
- Check issue assignments via heartbeat
- Report status on completed tasks
