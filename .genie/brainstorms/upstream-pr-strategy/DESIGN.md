# Design: Upstream PR Strategy

**Status:** Ready
**Slug:** `upstream-pr-strategy`
**From:** brainstorm
**Created:** 2026-03-15

---

## Problem

Our fork (namastexlabs/paperclip) is 65 commits / ~12,900 lines ahead of upstream (paperclipai/paperclip). A single mega-PR is unreviewable. Need to decompose into the minimum number of logical, self-contained PRs that upstream maintainers can review and merge.

## Context

- Multiuser feature was **pre-discussed with upstream** — Path 2 (CONTRIBUTING.md) applies
- Upstream already has the multiuser **schema** (migration 0014) — tables exist, code to use them doesn't
- Our `0028_owner_permission_backfill.sql` is a loose SQL file NOT in the drizzle journal — must become a proper migration at index 0030
- Our `0030_company_image.sql` must be renumbered to 0031
- Test harness imports are clean against upstream code (no multiuser deps)

## Decision: 3 PRs

Council unanimously recommended 3 PRs. Rationale:
- Migrations are the hard boundary — both ours belong in the multiuser PR
- Test harness stands alone (imports verified clean)
- HMR fix is ~100 lines, Path 1 immediate merge
- More PRs = more rebase cycles against a moving upstream

### PR1: HMR/WebSocket fix (Path 1 — immediate)

**Scope:** Fix Vite HMR WebSocket for reverse proxy + React StrictMode WS double-invoke
**Files:** `ui/src/context/LiveUpdatesProvider.tsx`, `ui/index.html`
**Size:** ~100 lines
**Migrations:** None
**Strategy:** Cherry-pick final state only (skip the 10 iterations)

### PR2: Test infrastructure + coverage (Path 1)

**Scope:** Embedded-postgres test harness, global setup, comprehensive route+service test coverage
**Files:** `server/src/__tests__/**` (39 files), `server/vitest.config.ts`, `vitest.config.ts`, `package.json` (devDeps)
**Size:** ~5,500 lines (all tests)
**Migrations:** None
**Strategy:** Squash into clean commit. Tests run against upstream's existing code.
**Pre-flight verified:** `test-app.ts` imports `accessRoutes` which exists on upstream. No imports of `userRoutes`, `email`, or multiuser-only code.

### PR3: Full multiuser feature (Path 2 — pre-discussed)

**Scope:** Everything else — permissions runtime, email service, auth UX, invite flow, user menu, task assignment, user names in API, @mentions, inbox, avatars, company logo, mobile nav
**Files:** ~70 files across server routes/services, shared constants/validators, UI pages/components, DB migrations
**Size:** ~7,000 lines
**Migrations:**
- `0030_owner_permission_backfill.sql` (NEW — rename from orphan 0028, add to journal) — grants all 6 permission keys to existing owners so they don't lose access on upgrade
- `0031_company_image.sql` (renumber from 0030) — adds `image` column to companies table
- Regenerate snapshots + journal for both
- Delete old `0028_owner_permission_backfill.sql`

**Strategy:** Squash-rebase onto upstream/master. Excellent PR description with sections per area + before/after screenshots. Discuss in #dev Discord first per CONTRIBUTING.md Path 2.

**PR description structure:**
- Summary: what multiuser adds
- Backend: permissions runtime, email service (Resend), user routes, mention delivery
- Frontend: auth UX, user menu, account page, invite landing, mention autocomplete, inbox, avatars
- Migrations: what each does and why (especially the backfill)
- Screenshots: before/after for key flows
- Testing: manual smoke test evidence

## Ordering

```
PR1 (HMR fix) ──────────▸ merge immediately (Path 1)
PR2 (test infra) ────────▸ merge next (Path 1, no deps)
PR3 (multiuser) ─────────▸ merge last (Path 2, discuss in #dev first)
```

PR1 and PR2 can go in parallel. PR3 should go after PR2 so test coverage is already upstream when the feature lands.

## Migration Renumbering Plan

Current state:
```
0028_harsh_goliath.sql          (upstream — in journal at idx 28)
0028_owner_permission_backfill.sql  (ours — NOT in journal, orphan)
0029_plugin_tables.sql          (upstream — in journal at idx 29)
0030_company_image.sql          (ours — in journal at idx 30)
```

Target state for PR3:
```
0028_harsh_goliath.sql          (upstream — unchanged)
0029_plugin_tables.sql          (upstream — unchanged)
0030_owner_permission_backfill.sql  (ours — NEW journal entry at idx 30)
0031_company_image.sql          (ours — renumbered, journal entry at idx 31)
```

Steps:
1. Delete `0028_owner_permission_backfill.sql`
2. Create `0030_owner_permission_backfill.sql` with same content
3. Rename `0030_company_image.sql` → `0031_company_image.sql`
4. Rename `meta/0030_snapshot.json` → `meta/0031_snapshot.json`
5. Add journal entry for idx 30 (backfill)
6. Update journal entry idx 30→31 for company_image
7. Regenerate `0030_snapshot.json` for the backfill (snapshot of schema state after backfill = same as 0029 since backfill is data-only)

## Risks

- **RISK-1:** Upstream may have added migrations 0030+ by the time we submit PR3. Mitigation: renumber at PR creation time, not now.
- **RISK-2:** Squash-rebase of 50+ commits may produce conflicts if upstream has changed shared files. Mitigation: rebase immediately before opening PR.
- **RISK-3:** PR3 is ~7k lines — may still feel large to reviewers. Mitigation: excellent description, screenshots, offer to walk through in Discord call.
