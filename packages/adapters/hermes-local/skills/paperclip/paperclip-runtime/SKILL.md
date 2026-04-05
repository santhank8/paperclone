---
name: paperclip-runtime
description: Hermes companion skill for interpreting Paperclip wake context, task IDs, comment wakes, and approval wakes.
---

# paperclip-runtime

Environment variables commonly injected by the Hermes Paperclip adapter:
- PAPERCLIP_API_URL
- PAPERCLIP_COMPANY_ID
- PAPERCLIP_AGENT_ID
- PAPERCLIP_RUN_ID
- PAPERCLIP_TASK_ID
- PAPERCLIP_WAKE_REASON
- PAPERCLIP_WAKE_COMMENT_ID
- PAPERCLIP_APPROVAL_ID
- PAPERCLIP_APPROVAL_STATUS
- PAPERCLIP_LINKED_ISSUE_IDS
- PAPERCLIP_WORKSPACE_CWD
- PAPERCLIP_WORKSPACE_ID
- PAPERCLIP_WORKSPACE_REPO_URL
- PAPERCLIP_WORKSPACE_REPO_REF

Rules:
- Treat wakeReason as high-priority operator context.
- Reuse the injected $PAPERCLIP_* env vars in commands instead of retyping UUIDs from the prompt.
- If approval fields are present, inspect the approval before acting.
- If taskId is present, act on that issue before scanning for unrelated work.
