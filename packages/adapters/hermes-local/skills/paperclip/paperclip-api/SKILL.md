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
- Prefer $PAPERCLIP_API_URL, $PAPERCLIP_COMPANY_ID, $PAPERCLIP_AGENT_ID, and $PAPERCLIP_TASK_ID over hand-copying UUIDs.
- For JSON writes, prefer writing a payload file and using `--data @file` instead of inline JSON.
- If the payload includes `$PAPERCLIP_*` placeholders, create it from the terminal so the shell expands them before the request.
- Prefer reading the live object first before mutating it.
- When mutating issues or approvals, leave a short operator-visible comment when it helps explain what happened.
