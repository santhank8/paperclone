# Issue Detail Latest Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make issue detail open at the latest progress by default without stealing scroll back after the user leaves the bottom.

**Architecture:** Keep scroll-follow state in `IssueDetail`, but move the actual follow/bypass decisions into a small pure helper module under `ui/src/lib`. Reuse the existing page scroller and current `ScrollToBottom` affordance instead of adding a second bottom-jump control.

**Tech Stack:** React 19, Vite, Vitest, TypeScript

---

### Task 1: Add failing tests for scroll-follow decisions

**Files:**
- Create: `ui/src/lib/issue-detail-scroll.test.ts`

**Step 1: Write the failing test**

- Cover initial open auto-scroll, deep-link bypass, near-bottom detection, and follow release on growth.

**Step 2: Run test to verify it fails**

Run: `pnpm test --run ui/src/lib/issue-detail-scroll.test.ts`

Expected: FAIL because `ui/src/lib/issue-detail-scroll.ts` does not exist yet.

### Task 2: Implement the pure scroll decision helpers

**Files:**
- Create: `ui/src/lib/issue-detail-scroll.ts`
- Test: `ui/src/lib/issue-detail-scroll.test.ts`

**Step 1: Write minimal implementation**

- Add helpers for deep-link detection, initial auto-position eligibility, near-bottom detection, and growth-based follow release.

**Step 2: Run test to verify it passes**

Run: `pnpm test --run ui/src/lib/issue-detail-scroll.test.ts`

Expected: PASS

### Task 3: Wire follow state into issue detail

**Files:**
- Modify: `ui/src/pages/IssueDetail.tsx`

**Step 1: Integrate helpers**

- Track whether the page is currently following the bottom.
- Auto-position once on initial open when allowed.
- Stop auto-follow after the user scrolls away.
- Preserve deep-link navigation targets.

**Step 2: Run focused tests**

Run: `pnpm test --run ui/src/lib/issue-detail-scroll.test.ts`

Expected: PASS

### Task 4: Verify broader UI safety

**Files:**
- Modify: `ui/src/pages/IssueDetail.tsx`

**Step 1: Run targeted verification**

Run:
- `pnpm test --run ui/src/lib/issue-detail-scroll.test.ts`
- `pnpm test --run ui/src/pages/Inbox.test.tsx`

Expected: PASS
