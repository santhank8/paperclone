---
name: api_key_not_injected
description: PAPERCLIP_API_KEY not auto-injected by local adapter during heartbeat — requires manual local-cli workaround
type: feedback
---

PAPERCLIP_API_KEY was not auto-injected when the CEO agent heartbeat ran via the local adapter. Had to use `pnpm paperclipai agent local-cli ceo` to obtain credentials manually.

**Why:** The local adapter should provision a short-lived JWT and inject it as PAPERCLIP_API_KEY before the agent session starts. Without it, all API calls fail with "Agent authentication required."

**How to apply:** At session start, check if PAPERCLIP_API_KEY is set. If not, run `pnpm paperclipai agent local-cli <agent-shortname> --company-id $PAPERCLIP_COMPANY_ID` to get credentials. This is a platform bug to report — not a permanent workaround.
