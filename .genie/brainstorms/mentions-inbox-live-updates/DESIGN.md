# Design: Mentions, Inbox State, and Live UI Noise

Date: 2026-03-15
Status: Trace findings captured for wish planning

## Summary

This trace covered three user-visible problems:

1. `@` mentions inserted while creating a new issue do not show up in the mentioned person's inbox.
2. Comment mentions do show up, but they have no durable read/unread state and stay in the unread inbox forever.
3. Opening the New Issue dialog emits UI console noise: a missing `DialogTitle` warning and a WebSocket close-before-established warning.

The first two are confirmed functional defects. The dialog warning is a confirmed accessibility defect. The WebSocket line is most likely a client-side dev-mode noise bug rather than the root cause of missing mentions.

## Confirmed Findings

### 1. Create-time mentions are never processed

The new issue dialog collects mentionable people and agents into the markdown description field, then sends that description in the create payload. See:

- `ui/src/components/NewIssueDialog.tsx:240`
- `ui/src/components/NewIssueDialog.tsx:305`
- `ui/src/components/NewIssueDialog.tsx:348`
- `ui/src/components/NewIssueDialog.tsx:1123`

The server create route stores the issue and logs `issue.created`, but it never invokes mention processing:

- `server/src/routes/issues.ts:699`
- `server/src/routes/issues.ts:707`
- `server/src/routes/issues.ts:713`

Comment and update flows do invoke mention processing:

- `server/src/routes/issues.ts:894`
- `server/src/routes/issues.ts:1254`
- `server/src/services/issues.ts:1462`

Root cause:

- `POST /companies/:companyId/issues` does not call `svc.processMentionNotifications(...)` or any equivalent create-time mention pipeline.

Causal chain:

- User picks a mention in the new issue description.
- The mention text is saved in `issues.description`.
- The create route emits only `issue.created`.
- No `issue.user_mentioned` activity row is created.
- `/companies/:companyId/mentions` has nothing to return for that issue.
- Inbox and badge counts never reflect the mention.

Confidence: high

### 2. Mention inbox items have no read/unread model

The mentions endpoint returns raw mention activity rows only:

- `server/src/routes/activity.ts:89`
- `server/src/routes/activity.ts:107`
- `server/src/routes/activity.ts:125`

It does not join against `issue_read_states`, does not compute a read flag, and does not filter out mentions whose issue has already been read.

The issue read model is separate and only powers touched-issue unread state:

- `server/src/routes/issues.ts:596`
- `server/src/services/issues.ts:255`
- `server/src/services/issues.ts:276`

The inbox UI always renders mentions whenever any mention rows exist, including on the unread tab:

- `ui/src/pages/Inbox.tsx:345`
- `ui/src/pages/Inbox.tsx:578`
- `ui/src/pages/Inbox.tsx:695`

The sidebar badge also counts all mention rows forever:

- `ui/src/hooks/useInboxBadge.ts:97`
- `ui/src/lib/inbox.ts:108`
- `ui/src/lib/inbox.ts:145`

Remote browser evidence:

- On `https://felipe.genie.namastex.io/NAM/inbox/recent`, the inbox showed both a mention row (`NAM-8 genie mention mentioned ...`) and a touched-issue unread row (`genie mention NAM-8 commented ...`).
- After opening `NAM-8`, navigating to `https://felipe.genie.namastex.io/NAM/inbox/unread` still showed the mention row and the sidebar still showed `Inbox 1`.
- That matches the code split: opening the issue marks the issue read, but the mention query ignores read state entirely.

Root cause:

- Mention rows are modeled as immutable activity log entries with no derived or persisted read state.

Causal chain:

- A comment mention creates `issue.user_mentioned` activity.
- The mentions endpoint returns that activity row forever.
- Marking the issue read updates `issue_read_states`, not the mention query.
- The unread inbox and sidebar badge continue to count the mention.
- The UI has no unread visual treatment for mention rows because it receives no read flag.

Confidence: high

### 3. New Issue dialog is missing an accessible title

`DialogContent` from the shared UI wrapper renders a Radix dialog content node and expects a title to exist somewhere inside:

- `ui/src/components/ui/dialog.tsx:48`
- `ui/src/components/ui/dialog.tsx:119`

`NewIssueDialog` renders custom header text but no `DialogTitle`:

- `ui/src/components/NewIssueDialog.tsx:757`
- `ui/src/components/NewIssueDialog.tsx:797`

The same pattern also exists in at least:

- `ui/src/components/NewGoalDialog.tsx:117`
- `ui/src/components/NewProjectDialog.tsx:215`
- `ui/src/components/NewAgentDialog.tsx:130`

Root cause:

- These custom dialogs bypass `DialogHeader` / `DialogTitle` and only render visual header text.

Causal chain:

- Dialog opens.
- Radix accessibility check runs.
- No `DialogTitle` is present in the content subtree.
- The browser console emits the warning.

Confidence: high

### 4. The WebSocket console line is most likely dev-mode client noise

The app mounts under React `StrictMode`:

- `ui/src/main.tsx:39`

`LiveUpdatesProvider` explicitly contains a comment about avoiding the exact dev-mode warning, but still closes the socket from `onerror`:

- `ui/src/context/LiveUpdatesProvider.tsx:546`
- `ui/src/context/LiveUpdatesProvider.tsx:574`
- `ui/src/context/LiveUpdatesProvider.tsx:584`

The backend WebSocket server is present and properly wired with session-based upgrade auth in authenticated mode:

- `server/src/index.ts:515`
- `server/src/realtime/live-events-ws.ts:95`
- `server/src/realtime/live-events-ws.ts:178`

Most likely root cause:

- In a dev build, the provider mounts under `StrictMode`, and/or a transient upgrade error occurs.
- The client `onerror` handler immediately calls `socket.close()`.
- Browsers log this as "WebSocket is closed before the connection is established."

This explains the specific console text more directly than a missing backend route. I did not independently prove a persistent transport outage on the remote host.

Confidence: medium

## Correction Direction

1. Generalize mention processing so issue creation and issue comments both pass through the same mention resolution and notification contract.
2. Define mention unread state against the existing issue read model unless implementation shows that a separate mention-read table is required.
3. Update inbox rows and badge counts to use unread mentions, not all mention activity.
4. Add hidden or visible `DialogTitle` elements to custom dialogs using `DialogContent`.
5. Reduce WebSocket console noise in dev by avoiding self-inflicted `close()` behavior during early connection errors and verifying reconnect behavior in authenticated mode.

