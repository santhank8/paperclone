# Wish: Upstream PR Strategy — Ship Fork Work to paperclipai/paperclip

**Status:** IN_PROGRESS
**Slug:** `upstream-pr-strategy`
**Created:** 2026-03-15
**Updated:** 2026-03-17

---

## Summary

Our fork (namastexlabs/paperclip) is 65 commits / ~12,900 lines ahead of upstream. This wish creates 3 clean, self-contained PR branches against upstream/master: a tiny HMR fix, a standalone test infrastructure PR, and the full multiuser feature PR. Each branch is squash-rebased for clean history. Migration renumbering is required for the multiuser PR (backfill at 0030, company_image at 0031).

All PRs must have **rich, contribution-quality descriptions** with screenshots, cross-references explaining why the work is split into 3 PRs, and testing evidence. QA each PR branch locally (typecheck, tests, build). Use agent-browser for visual QA/screenshots of the running app.

---

## Scope

### IN
- Create 3 PR branches from upstream/master with clean squashed commits
- PR1: HMR/WebSocket fix (~100 lines, 2 files)
- PR2: Test infrastructure + coverage (~5,500 lines, ~40 test files + configs)
- PR3: Full multiuser feature (~7,000 lines, ~70 files, 2 migrations)
- Renumber migrations: orphan `0028_owner_permission_backfill` → proper `0030`, `0030_company_image` → `0031`
- Regenerate drizzle journal + snapshots for renumbered migrations
- Write PR descriptions per CONTRIBUTING.md Path 2 (screenshots, what/why, testing evidence)
- Open all 3 PRs against `upstream` remote (`paperclipai/paperclip`)

### OUT
- Merging PRs (humans merge — agents only create PRs)
- Dependency modernization (separate wish)
- Any new feature work beyond what's already in the fork
- Modifying upstream's existing code beyond what our fork changes

---

## Decisions

- **DEC-1: 3 PRs, not 6.** Council review concluded: migrations are the hard boundary (both belong in multiuser PR), test harness stands alone (imports verified clean), HMR is trivial. More PRs = more rebase overhead.
- **DEC-2: Squash-rebase, not cherry-pick.** Clean single-commit branches against upstream/master. Skip the 10 HMR iterations, the merge commits, the review fixup commits. Show only the final state.
- **DEC-3: Migration renumbering at PR creation time.** Upstream may add 0030+ before we submit. Final numbering is determined when the branch is created, based on upstream/master HEAD at that moment.
- **DEC-4: Backfill must be a proper drizzle migration.** The `0028_owner_permission_backfill.sql` is currently an orphan (not in journal). It grants all 6 permission keys to existing owners — without it, owners lose permissions on upgrade. Must be added to journal as a proper numbered migration.
- **DEC-5: PR2 tests must pass against upstream code.** The test harness imports only routes/services that exist on upstream. Verified: `test-app.ts` does NOT import `userRoutes`, `email`, or any multiuser-only modules.

---

## Success Criteria

- [ ] 3 PR branches exist, each cleanly rebased on upstream/master
- [ ] PR1 branch: `pnpm -r typecheck && pnpm test:run` passes against upstream
- [ ] PR2 branch: all tests pass against upstream code (no multiuser deps)
- [ ] PR3 branch: `pnpm -r typecheck && pnpm test:run && pnpm -r build` passes
- [ ] PR3 migrations: `0030_owner_permission_backfill.sql` in journal, `0031_company_image.sql` in journal
- [ ] PR3 migrations: no orphan `0028_owner_permission_backfill.sql` exists
- [ ] All 3 PRs opened on `paperclipai/paperclip` with proper descriptions
- [ ] PR3 description includes before/after screenshots + migration explanation
- [ ] `git diff upstream/master..pr3-branch --stat` shows no `.genie/`, no `pnpm-lock.yaml`

---

## Assumptions

- **ASM-1:** Upstream hasn't added migrations beyond 0029 by PR creation time (check and renumber if they have)
- **ASM-2:** Upstream's test runner can execute our test harness (embedded-postgres, global-setup pattern)
- **ASM-3:** PR3 multiuser feature was pre-approved in concept by upstream maintainers

## Risks

- **RISK-1:** Upstream adds migrations 0030+ before we submit PR3. **Mitigation:** Renumber at branch creation time, not now.
- **RISK-2:** Squash-rebase of ~50 commits may produce conflicts on shared files (app.ts, access.ts, issues.ts). **Mitigation:** Rebase immediately before opening, resolve conflicts manually.
- **RISK-3:** PR3 at ~7k lines may still feel large. **Mitigation:** Excellent PR description with section headers, before/after screenshots, offer Discord walkthrough.
- **RISK-4:** PR2 tests may fail against upstream if upstream changed route signatures since our last sync. **Mitigation:** Run tests against upstream/master before opening PR.

---

## Execution Groups

### G1: Create PR1 — HMR/WebSocket Fix
**Goal:** Open a tiny Path 1 PR fixing Vite HMR behind reverse proxy + WS StrictMode double-invoke.

**Deliverables:**
1. Create branch `fix/hmr-websocket-reverse-proxy` from upstream/master
2. Extract final-state diff for `ui/src/context/LiveUpdatesProvider.tsx` and `ui/index.html` from our fork
3. Apply as single clean commit with descriptive message
4. Verify typecheck + tests pass
5. Open PR on `paperclipai/paperclip`

**Acceptance criteria:**
- Branch exists with 1 commit on upstream/master
- Only 2 files changed
- `pnpm -r typecheck` passes
- PR is open with clear description

**Validation:** `git diff upstream/master..fix/hmr-websocket-reverse-proxy --name-only | wc -l` (should be 2)

**Files:**
- `ui/src/context/LiveUpdatesProvider.tsx`
- `ui/index.html`

---

### G2: Create PR2 — Test Infrastructure + Coverage
**Goal:** Open a Path 1 PR adding embedded-postgres test harness and comprehensive route+service test coverage.

**Deliverables:**
1. Create branch `test/server-coverage-harness` from upstream/master
2. Extract final-state diff for all test files, vitest configs, and devDep additions
3. Apply as single clean commit
4. Verify ALL tests pass against upstream's code (no multiuser code present)
5. Open PR on `paperclipai/paperclip`

**Acceptance criteria:**
- Branch has 1 commit on upstream/master
- ~40 test files + 2 vitest configs + package.json devDeps
- `pnpm test:run` passes (all tests pass against upstream code)
- No imports of multiuser-only modules (userRoutes, email service, etc.)
- PR is open with description explaining the harness pattern

**Validation:** `cd server && pnpm test:run` (all tests pass)

**Files:**
- `server/src/__tests__/**` (~39 files)
- `server/vitest.config.ts`
- `vitest.config.ts`
- `package.json` (devDep additions: `@vitest/coverage-v8`, `cross-env`)
- `server/package.json` (devDep: `postgres`)

**depends-on:** none (parallel with G1)

---

### G3: Migration Renumbering
**Goal:** Fix migration numbering so the backfill is a proper drizzle migration and company_image follows sequentially.

**Deliverables:**
1. Check upstream/master HEAD for latest migration index (currently 0029)
2. Delete `packages/db/src/migrations/0028_owner_permission_backfill.sql`
3. Create `packages/db/src/migrations/0030_owner_permission_backfill.sql` (same SQL content)
4. Rename `0030_company_image.sql` → `0031_company_image.sql`
5. Rename `meta/0030_snapshot.json` → `meta/0031_snapshot.json` (MUST rename before copy to avoid overwrite)
6. Copy `meta/0029_snapshot.json` → `meta/0030_snapshot.json` (backfill is data-only, schema unchanged)
7. Update `meta/_journal.json`:
   - Change idx 30 entry tag from `0030_company_image` to `0030_owner_permission_backfill`
   - Add idx 31 entry for `0031_company_image`
8. Verify drizzle-kit is happy: `pnpm db:generate` shows no unexpected diff

**Acceptance criteria:**
- No file named `0028_owner_permission_backfill.sql` exists
- `0030_owner_permission_backfill.sql` exists with correct INSERT content
- `0031_company_image.sql` exists with `ALTER TABLE "companies" ADD COLUMN "image" text;`
- Journal has entries at idx 30 and 31 with correct tags
- Snapshots exist for both 0030 and 0031

**Validation:** `python3 -c "import json; j=json.load(open('packages/db/src/migrations/meta/_journal.json')); entries={e['idx']:e['tag'] for e in j['entries']}; assert entries[30]=='0030_owner_permission_backfill'; assert entries[31]=='0031_company_image'; print('OK')"`

**Files:**
- `packages/db/src/migrations/0028_owner_permission_backfill.sql` (delete)
- `packages/db/src/migrations/0030_owner_permission_backfill.sql` (create)
- `packages/db/src/migrations/0030_company_image.sql` → `0031_company_image.sql` (rename)
- `packages/db/src/migrations/meta/_journal.json` (update)
- `packages/db/src/migrations/meta/0030_snapshot.json` (create from 0029 copy)
- `packages/db/src/migrations/meta/0031_snapshot.json` (rename from 0030)

---

### G4: Create PR3 — Full Multiuser Feature
**Goal:** Open the big Path 2 PR with all multiuser code, renumbered migrations, and polished description.

**Deliverables:**
1. Create branch `feat/multiuser-support` from upstream/master
2. Extract final-state diff for ALL non-test, non-HMR changes from our fork (excluding `.genie/`, `pnpm-lock.yaml`)
3. Include G3's renumbered migrations
4. Apply as single clean commit (or 2-3 logical commits: backend, frontend, migrations)
5. Verify `pnpm -r typecheck && pnpm test:run && pnpm -r build` passes
6. Write PR description per CONTRIBUTING.md Path 2:
   - Summary of what multiuser adds
   - Backend section: permissions runtime, email service, user routes, mentions
   - Frontend section: auth UX, user menu, account, invite, mentions, avatars
   - Migrations section: explain backfill purpose (owners keep permissions on upgrade)
   - Screenshots: before/after for login, user menu, mentions, avatars
   - Testing evidence
7. Open PR on `paperclipai/paperclip`

**Acceptance criteria:**
- Branch cleanly rebased on upstream/master
- No `.genie/` files in diff
- No `pnpm-lock.yaml` in diff
- `pnpm -r typecheck && pnpm test:run && pnpm -r build` passes
- Migrations properly numbered (0030 backfill, 0031 company_image)
- PR description has all Path 2 sections
- PR is open on upstream

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm -r build`

**Files:** ~72 files across:
- `packages/shared/src/` (constants, types, validators)
- `packages/db/src/` (schema, migrations)
- `server/src/` (routes, services, auth, config)
- `ui/src/` (pages, components, hooks, api, context)
- `cli/src/commands/` (configure.ts, onboard.ts, worktree-lib.ts — email config additions)
- `cli/src/__tests__/` (4 test files with email config test updates)
- `server/package.json`, `ui/package.json` (deps)

**depends-on:** G3 (migrations must be renumbered first)

---

### G5: QA All PR Branches
**Goal:** Verify each PR branch compiles, tests pass, and builds cleanly against upstream/master.

**Deliverables:**
1. For each branch (`fix/hmr-websocket-reverse-proxy`, `test/server-coverage-harness`, `feat/multiuser-support`):
   - `pnpm install`
   - `pnpm -r typecheck`
   - `pnpm test:run`
   - `pnpm -r build`
2. Fix any failures found
3. Use agent-browser to take screenshots of the running app for PR3:
   - Login page (before/after auth UX)
   - User menu dropdown
   - Account settings page
   - Company settings with members section
   - Invite flow / landing page
   - @mention autocomplete in issue creation
   - Inbox with mention notifications
   - User avatar in CompanyRail + mobile nav
   - Company logo upload + crop dialog

**Acceptance criteria:**
- All 3 branches pass typecheck + tests + build
- Screenshots captured for PR3 description
- Any failures fixed and pushed

**Validation:** All 3 branches green on typecheck + tests + build

**depends-on:** G1, G2, G4

---

### G6: Write Rich PR Descriptions + Cross-References
**Goal:** Update all 3 PRs with contribution-quality descriptions explaining the full strategy, with screenshots and cross-links.

**Deliverables:**
1. Update PR1 (#1001) description to:
   - Reference the 3-PR strategy: "This is PR 1/3 in our multiuser contribution series"
   - Explain it's a standalone fix, reviewable independently
   - Link to PR2 and PR3
2. Update PR2 (#1002) description to:
   - Reference the 3-PR strategy: "This is PR 2/3 in our multiuser contribution series"
   - Explain test harness pattern and why real postgres not mocks
   - Note that PR3 adds 3 more test files that depend on multiuser code
   - Link to PR1 and PR3
3. Create/update PR3 description with FULL Path 2 treatment:
   - "This is PR 3/3 in our multiuser contribution series"
   - Summary: what multiuser enables for Paperclip
   - **Backend** section: permissions runtime, email service (Resend), user routes, mention delivery, heartbeat user context
   - **Frontend** section: auth UX overhaul, user menu, account page, invite landing, @mention autocomplete, inbox mentions, avatars, company logo
   - **Migrations** section: explain backfill (owners keep permissions), company_image, numbering rationale
   - **Screenshots**: embed all screenshots from G5
   - **Testing**: evidence of typecheck/tests/build passing
   - **How to review**: suggested review order (migrations → backend → frontend)
   - Cross-links to PR1 and PR2
4. Each PR description explains WHY 3 PRs: "We split into 3 PRs for reviewability: a tiny standalone fix, test infrastructure (independently valuable), and the full feature. They can be merged in any order — PR1 and PR2 have no dependencies on PR3."

**Acceptance criteria:**
- All 3 PRs have updated descriptions with cross-references
- PR3 has screenshots embedded
- PR3 has all Path 2 sections
- Each PR explains the 3-PR strategy

**Validation:** `gh pr view 1001 --repo paperclipai/paperclip --json body | jq -r .body | grep -c "PR.*3"` (should find strategy references)

**depends-on:** G5

---

## Dependency Graph

```
G1 (PR1: HMR) ─────────────────────┐
G2 (PR2: tests) ───────────────────┤
G3 (migration) ──▸ G4 (PR3: multi) ┤
                                    ├──▸ G5 (QA) ──▸ G6 (descriptions)
                                    │
```

## Progress

- [x] G1: PR1 opened — https://github.com/paperclipai/paperclip/pull/1001
- [x] G2: PR2 opened — https://github.com/paperclipai/paperclip/pull/1002
- [x] G3: Migrations renumbered (0030 backfill, 0031 company_image)
- [ ] G4: PR3 branch has 75 files staged, needs commit + push + PR creation
- [ ] G5: QA all branches + capture screenshots
- [ ] G6: Write rich PR descriptions with cross-references + screenshots
