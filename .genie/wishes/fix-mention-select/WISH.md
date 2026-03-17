# Wish: Fix @mention Selection in Dialogs (Click + Tab/Enter)

**Status:** SHIPPED
**Slug:** `fix-mention-select`
**Created:** 2026-03-15

---

## Summary

@mention autocomplete items cannot be clicked or selected via Tab/Enter when the MarkdownEditor is inside a Dialog (e.g., NewIssueDialog). The dropdown appears but selections are silently ignored. Root cause: `selectionchange` event clears the mention state ref before the click handler reads it, and the keyboard guard uses React state instead of the ref.

---

## Scope

### IN
- Fix click selection: capture mention state at render time, pass to selectMention directly
- Fix Tab/Enter selection: use mentionStateRef in the keyboard guard instead of React state
- Both fixes in `ui/src/components/MarkdownEditor.tsx` only

### OUT
- Changes to Radix Dialog behavior
- Changes to NewIssueDialog or IssueDetail
- New mention UI features

---

## Decisions

- **DEC-1:** For clicks — capture `mentionState` snapshot at render time in a closure, pass it directly to a modified selectMention that accepts state as a parameter. This avoids the selectionchange race entirely.
- **DEC-2:** For Tab/Enter — change the `mentionActive` guard to also check `mentionStateRef.current`, consistent with how `selectMention` already reads from the ref.

---

## Success Criteria

- [ ] Clicking a mention item in NewIssueDialog inserts the @mention text
- [ ] Pressing Tab/Enter on a highlighted mention in NewIssueDialog inserts the text
- [ ] Mentions still work correctly on IssueDetail page (no regression)
- [ ] `pnpm -r typecheck && pnpm build` pass

---

## Execution Groups

### Group A: Fix MarkdownEditor Mention Selection

**Depends on:** None

**Deliverables:**
1. Add `state` parameter to `selectMention` (or create `selectMentionWithState`) that accepts the mention state directly instead of reading from `mentionStateRef.current`
2. In the dropdown render (~line 578), capture `mentionState` snapshot and pass it on `onMouseDown`
3. Change `mentionActive` guard (~line 497) to: `(mentionState !== null || mentionStateRef.current !== null) && mentions && mentions.length > 0`
4. Update `filteredMentions` to also fall back to `mentionStateRef.current?.query` if `mentionState` is null

**Acceptance Criteria:**
- [ ] Click inserts mention in Dialog context
- [ ] Tab/Enter inserts mention in Dialog context
- [ ] No regression on IssueDetail page

**Validation:** `pnpm -r typecheck && pnpm build`

---

## Files to Create/Modify

```
ui/src/components/MarkdownEditor.tsx — fix selectMention race + keyboard guard
```
