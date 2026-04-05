---
name: paperclip-api
description: Hermes companion skill for Paperclip control-plane API calls and auth header discipline.
---

# paperclip-api

Use this skill whenever you need to call the Paperclip API from Hermes.

Rules:
- Always use terminal + curl for Paperclip API calls.
- Always send Authorization: Bearer $PAPERCLIP_API_KEY.
- Always send X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID on POST and PATCH calls.
- Prefer reading the live object first before mutating it.
- When mutating issues or approvals, leave a short operator-visible comment when it helps explain what happened.
