# Issue Detail Latest Progress Design

## Context

`IssueDetail` currently renders the timeline via `CommentThread` and exposes a generic floating `ScrollToBottom` button, but it does not actively position the reader at the newest activity on first open. It also lacks an explicit follow-state model for deciding when new timeline items should auto-scroll and when user scroll intent should win.

## Decision

Adopt a page-level follow controller inside `ui/src/pages/IssueDetail.tsx`.

- On first issue open, if there is no deep link hash for a comment or document, auto-position to the bottom of the active scroller so the newest activity is visible.
- While the reader remains near the bottom, new timeline growth keeps the page pinned to latest activity.
- If the reader scrolls away from the bottom, release follow immediately and stop auto-scrolling on refresh or new comments.
- If navigation includes `#comment-*` or `#document-*`, respect that explicit target and skip default bottom positioning.

## Implementation Shape

- Add a pure helper module for issue-detail scroll decisions so the follow rules are unit-testable.
- Reuse the proven bottom-distance / growth-delta pattern already used in `AgentDetail`.
- Keep the existing `ScrollToBottom` button as the explicit recovery action instead of introducing a second jump UI.

## Testing

- Unit-test the pure decision helpers for:
  - initial auto-position enable/disable
  - deep-link bypass
  - bottom-tolerance detection
  - follow release when the user moves away during content growth
