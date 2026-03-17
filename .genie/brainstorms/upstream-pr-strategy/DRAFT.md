# Brainstorm: Upstream PR Strategy

**Status:** Simmering
**Slug:** `upstream-pr-strategy`
**Created:** 2026-03-15

## Problem

Our fork is 65 commits (47 non-merge) ahead of upstream with ~12,900 lines added across 117 files. One mega-PR is unreviewable. Need to decompose into logical, self-contained PRs that upstream maintainers can review independently.

## Raw Analysis — Commit Categories

### Category A: Test Infrastructure (standalone, no feature deps)
- `c49c5e4` test(server): add embedded-postgres test harness and coverage tooling
- `8bca6e6` test(server): add comprehensive service and route test coverage
- `23351cb` fix: address PR review feedback on test harness
- `987af6a` fix: update cleanDb() call to match new signature
- `43af600` fix: update all cleanDb() calls to match new parameterless signature
- `a74ce7f` fix: address PR review findings — hooks order, pending status, test assertions

### Category B: Permission/Role System (multiuser foundation)
- `cc77ffc` feat: add role-based permission system with member management
- `16d2c3e` fix: update membershipRole in setMemberPermissions to prevent UI desync

### Category C: Multiuser Feature Groups
- `72269e4` feat: add email service (Resend) + config infrastructure (Group 1)
- `8837a3c` feat: add user menu, logout, account settings (Group 2)
- `7fc3431` feat: fix auth UX, invite flow, password reset (Group 3)
- `e882a14` feat: add human task assignment + people endpoint (Group 4)
- `c693815` feat: enrich API responses with user names (Group 5)
- `c13fcf7` feat: add @mention humans + inbox mentions (Group 6)
- `dfb2544` Merge Group 2 (user menu) and Group 7 (role-aware UI) into dev
- `b9ac30f` feat: re-apply multiuser features after upstream merge

### Category D: Mention System Fixes (post-multiuser polish)
- `8f84a9e` fix: address PR#8 security and UX review gaps
- `9cd80c6` refactor: extract duplicated mention-notification logic into shared helper
- `27db2df` fix: address PR review — drop early return, capture emailSvc in const
- `baeb411` fix: match @mentions against individual name words, not just full name
- `9d87fa2` fix: add humans to @mention autocomplete in NewIssueDialog
- `a1f66fa` fix: @mention selection in Dialog — selectionchange race + state lag
- `e4bb047` fix: defer mention DOM mutation via RAF to bypass Dialog FocusScope
- `c5aeb5d` fix: @mention selection in Dialog + longest-match mention resolution
- `c1c99b1` fix: mention delivery on issue create, inbox unread state, and dialog warnings
- `23f8a10` fix: add tenant guard to listMentions join, await mentions before response

### Category E: Avatar / UI Polish (mixed standalone + multiuser)
- `4d38d77` feat(ui): move user avatar from sidebar to CompanyRail bottom
- `e7f033f` fix: propagate image field in Better Auth session response
- `1886045` feat: fix session image field + add avatar crop dialog
- `0c256a2` feat: company logo upload + crop dialog + CompanyRail display
- `9a685c2` fix: query user record in custom get-session handler
- `9d8fa33` feat: add user avatar to mobile bottom nav
- `0303021` fix: remove "Me" label from mobile nav avatar, use sm size

### Category F: HMR/WebSocket Fixes (standalone infra)
- `773bd76` fix: Vite HMR WebSocket for reverse proxy + deprecated meta tag
- Multiple iterations... final state is what matters
- `ddfa00a` fix: defer WS connect to avoid React StrictMode double-invoke error
- `fcfe786` fix: omit hmr.host so client uses window.location.hostname

### Category G: Misc/Chore
- `d45748a` fix: renumber company_image migration to 0030 after upstream merge
- `ca6c1c2` chore: remove pnpm-lock.yaml from PR
- `a354d6d` chore: reset lockfile to match master

## Open Questions
- Which categories can stand alone as upstream PRs?
- Which must be combined due to shared file changes?
- What's the optimal ordering?
