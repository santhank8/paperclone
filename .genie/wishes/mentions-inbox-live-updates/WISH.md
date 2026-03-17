# Wish: Fix Mention Inbox Delivery and Live UI Noise

| Field | Value |
|-------|-------|
| **Status** | DRAFT |
| **Slug** | `mentions-inbox-live-updates` |
| **Date** | 2026-03-15 |
| **Design** | [DESIGN.md](../../brainstorms/mentions-inbox-live-updates/DESIGN.md) |

## Summary
Creating or reading an issue does not keep mention delivery and unread state consistent with comment mentions, and the new-issue flow emits misleading console warnings. This wish restores create-time mention delivery, makes mention unread state behave like an operator expects, and removes the noisy console warnings tied to the new-issue flow.

## Scope
### IN
- Deliver `@user` and `@agent` notifications when a new issue is created with mentions in its description.
- Make mention inbox items derive a real read/unread state and stop appearing in unread once the underlying issue has been read.
- Update sidebar inbox counts and inbox rows to reflect unread mentions only.
- Add clear unread styling for mention rows in the inbox.
- Add accessible dialog titles to custom quick-create dialogs that currently trigger Radix warnings.
- Reduce or eliminate the client-side WebSocket close-before-established console noise while preserving reconnect behavior.
- Add regression coverage for create-time mention delivery and mention unread semantics.

### OUT
- A full redesign of the inbox information architecture.
- A standalone notification center separate from issues/comments.
- Replacing the current WebSocket transport with SSE or another realtime system.
- Reworking all activity feed copy, ordering, or toast semantics beyond mention-related behavior.

## Decisions
| Decision | Rationale |
|----------|-----------|
| Reuse `issue_read_states` as the default mention read model | The product already marks issues read on open and via inbox actions, so mention unread state should line up with the existing operator workflow unless the implementation proves this is too coarse. |
| Treat create-time mentions and comment-time mentions as the same domain concept | The current split is the root cause of the delivery bug; one shared pipeline keeps behavior consistent and testable. |
| Fix dialog warnings with accessible `DialogTitle` nodes rather than visual header redesign | The bug is structural, not stylistic. Hidden titles are acceptable where the current visual header should remain unchanged. |
| Treat the WebSocket console line as a client-side noise issue until proven otherwise | The backend upgrade path is already wired; the visible problem is the noisy client behavior in a dev build. |

## Success Criteria
- [ ] Creating a new issue with a mention in the description produces the same mention side effects as mentioning someone in a comment.
- [ ] A mentioned user sees the mention in inbox/badge state without needing a manual refresh cycle beyond the app’s normal query invalidation/live-update flow.
- [ ] After opening the mentioned issue or marking it read, the mention no longer appears in the unread inbox and no longer contributes to the unread badge.
- [ ] Mention rows in the inbox have a visible unread/read distinction.
- [ ] Opening the New Issue dialog no longer emits the Radix missing-title warning.
- [ ] The WebSocket close-before-established console line is either eliminated or reduced to genuine transport failures only, without breaking reconnect behavior.
- [ ] Targeted regression tests cover create-time mention delivery and unread mention behavior.

## Execution Groups

### Group 1: Mention Ingestion Contract
**Goal:** Make issue creation and comment creation use a consistent mention-notification path.
**Deliverables:**
1. Refactor server mention processing so create-time issue descriptions are scanned for mentioned agents and users.
2. Emit the same mention-side effects on create that already exist for comment mentions: user mention activity rows, agent wakeups where applicable, and notification side effects.
3. Add server tests covering issue creation with multi-word user/agent mentions.

**Acceptance criteria:**
- Creating an issue with `@Name` in the description results in persisted mention activity for users and wake/notification behavior for agents.
- Create-time mention delivery works for multi-word user and agent names already supported in comment mentions.
- Existing comment mention behavior remains intact.

**Validation:**
```bash
pnpm vitest run server/src/__tests__/services/issues.test.ts server/src/__tests__/routes/issues-full.test.ts
```

**depends-on:** none

### Group 2: Mention Read-State Contract
**Goal:** Define unread mentions against the existing issue read model and expose that state through the API contract.
**Deliverables:**
1. Extend the mentions query/response so each mention entry can be classified as unread vs read from mention timestamp and issue read state.
2. Update shared/UI types so mention entries carry the state needed by the inbox and badge logic.
3. Add tests that prove reading an issue clears unread mention state for older mentions on that issue.

**Acceptance criteria:**
- The mentions API can distinguish unread mentions from already-read mentions.
- Reading an issue changes mention unread state deterministically.
- The contract is synchronized across server, shared types, and UI API clients.

**Validation:**
```bash
pnpm vitest run server/src/__tests__/services/issues.test.ts server/src/__tests__/routes/activity-full.test.ts && pnpm -r typecheck
```

**depends-on:** Group 1

### Group 3: Inbox Mention UX
**Goal:** Make the inbox and sidebar reflect unread mentions accurately and visibly.
**Deliverables:**
1. Update inbox badge computation so mentions contribute only when unread.
2. Update the Inbox page so the unread tab shows unread mentions only and the all/recent views continue to show the broader mention history as designed.
3. Add unread visual treatment for mention rows comparable to the touched-issue affordance.

**Acceptance criteria:**
- The unread inbox tab stops showing read mentions.
- Sidebar inbox counts decrease after an issue with unread mentions is opened or marked read.
- Read mentions remain visible in `Recent` and `All` if the product continues to expose mention history there.
- Mention rows have a clear unread/read distinction.

**Validation:**
```bash
pnpm vitest run ui/src/lib/inbox.test.ts && pnpm -r typecheck
```
Manual validation: open `Recent`, `Unread`, and `All`, read a mentioned issue, and confirm the mention disappears from `Unread`, remains visible where intended elsewhere, and changes row treatment from unread to read.

**depends-on:** Group 2

### Group 4: Dialog Accessibility Audit
**Goal:** Remove the missing-title warning from the quick-create dialog family.
**Deliverables:**
1. Add `DialogTitle` coverage to New Issue, New Goal, New Project, and New Agent dialogs.
2. Audit any other custom quick-create dialog using `DialogContent` without a title and either fix it or explicitly exclude it from this wish with rationale.

**Acceptance criteria:**
- Opening New Issue, New Goal, New Project, and New Agent no longer triggers the Radix missing-title warning.
- Every dialog audited in this group has a recorded outcome and rationale: fixed in scope or explicitly excluded from scope with an explanation.

**Validation:**
```bash
pnpm -r typecheck && pnpm build
```
Manual validation: open each audited dialog in a dev browser session and capture console evidence that the missing-title warning is gone.

**depends-on:** none

### Group 5: Live-Update Console Hygiene
**Goal:** Reduce self-generated WebSocket console noise without weakening reconnect behavior.
**Deliverables:**
1. Tighten `LiveUpdatesProvider` error/cleanup behavior so normal dev-mode mounts and transient connection errors do not self-generate the close-before-established warning.
2. Verify authenticated-mode upgrade and reconnect behavior still works after the client change.
3. Document the exact manual repro and expected evidence for remount and reconnect scenarios.

**Acceptance criteria:**
- Ordinary dev-mode page load and remount flows do not emit the spurious close-before-established browser error.
- Genuine transport failures still reconnect correctly.
- The manual repro steps for remount and forced reconnect are written down and executable by another operator.

**Validation:**
```bash
pnpm -r typecheck && pnpm build
```
Manual validation: run an authenticated dev session, load a company page, remount the provider by refresh/navigation, then force a reconnect scenario (for example by restarting the server or briefly dropping the connection) and capture console plus behavioral evidence that reconnect still works.

**depends-on:** none

### Group 6: Regression Verification
**Goal:** Lock the behavior down with end-to-end verification and repo-wide checks.
**Deliverables:**
1. Run targeted mention, inbox, and route tests after implementation.
2. Run the full repository verification expected by the repo contract.
3. Capture any remaining manual browser checks for cross-user mention delivery and unread clearing.

**Acceptance criteria:**
- Automated checks pass and cover the touched server/UI paths.
- Manual browser verification confirms create-time mention delivery and unread clearing across users.

**Validation:**
```bash
pnpm -r typecheck && pnpm test:run && pnpm build
```

**depends-on:** Group 1, Group 2, Group 3, Group 4, Group 5

## Dependencies
- `depends-on`: Group 2 depends on Group 1.
- `depends-on`: Group 3 depends on Group 2.
- `depends-on`: Group 6 depends on Group 1, Group 2, Group 3, Group 4, and Group 5.

## Assumptions / Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Reusing `issue_read_states` may be too coarse if product later wants per-mention read tracking independent of issue reads | Medium | Implement against issue reads first, and only add a separate mention-read table if acceptance criteria cannot be met cleanly |
| The WebSocket console message may have more than one contributor on the remote host | Medium | Keep the fix scoped to the noisy client behavior and verify authenticated-mode upgrades manually after the change |
| The missing `DialogTitle` pattern exists in more dialogs than the one originally reported | Low | Audit all custom dialogs using `DialogContent` in the same pass so warnings are removed consistently |
