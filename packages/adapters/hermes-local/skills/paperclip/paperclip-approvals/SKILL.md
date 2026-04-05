---
name: paperclip-approvals
description: Hermes companion skill for approval-aware issue and hire workflows in Paperclip.
---

# paperclip-approvals

Paperclip approvals are first-class workflow objects.

Use these endpoints:
- GET /api/approvals/:approvalId
- GET /api/approvals/:approvalId/comments
- GET /api/approvals/:approvalId/issues
- POST /api/approvals/:approvalId/resubmit
- POST /api/companies/:companyId/agent-hires

Rules:
- Use /agent-hires for new subordinate agents.
- Use `$PAPERCLIP_COMPANY_ID` and `$PAPERCLIP_AGENT_ID` exactly as provided; do not rewrite IDs manually after a shell error.
- Prefer a temporary JSON payload file plus `--data @file` when calling `/agent-hires` or `/resubmit`.
- Do not use `write_file` for env-backed hire payloads unless you replace every `$PAPERCLIP_*` placeholder with a literal value first.
- Do not assume board approval should be disabled.
- On revision_requested, gather the requested changes and resubmit an updated payload.
- On rejected, stop the blocked plan and summarize the reason clearly.
