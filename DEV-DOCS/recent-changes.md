# Recent Changes Snapshot

Date: 2026-03-09

This file explains the recent commits in product terms so a human looking at the running app can tell what actually changed.

## The high-signal merged change

### `347aaef Add executive briefings and results layer (#1)`

This is the meaningful feature commit. It adds a new executive-facing interpretation layer beside the existing operations dashboard.

What that means in practice:

- The old shape was mostly:
  - goals/projects for intent
  - issues/comments/runs/approvals for execution
  - dashboard for telemetry
- The new shape is now:
  - goals
  - plans
  - work
  - results
  - briefings

### What was added

1. A new executive surface in the UI

- New sidebar destination: `Briefings`
- New routes:
  - `/briefings/board`
  - `/briefings/results`
  - `/briefings/plans`
  - `/briefings/records/:recordId`

What you should see:

- `Board`
  - executive summary view
  - six sections: landed outcomes, risks/blocks, decisions needed, project health, cost anomalies, executive rollups
- `Results`
  - filterable library of durable outcomes
- `Plans`
  - filterable library of pre-ticket planning artifacts
- record detail pages
  - a shared detail screen for plans, results, and briefings

2. First-class durable records

The app now has a real record model instead of forcing every meaningful output to stay buried in issue comments or run artifacts.

Supported record categories:

- `plan`
- `result`
- `briefing`

Supported plan kinds:

- `strategy_memo`
- `project_brief`
- `decision_record`
- `operating_plan`
- `weekly_objective`
- `risk_register`

Supported result kinds:

- `deliverable`
- `finding`
- `blocker`
- `decision_outcome`
- `status_report`

Supported briefing kinds:

- `daily_briefing`
- `weekly_briefing`
- `executive_rollup`
- `project_status_report`
- `incident_summary`
- `board_packet`

3. A new record storage layer in the DB

New tables:

- `records`
- `record_links`
- `record_attachments`
- `briefing_view_states`

Why this matters:

- one result can now roll up many issues/runs/approvals/projects
- executive summaries can be persisted instead of recomputed only in the UI
- "since my last visit" is tracked on the server, not just in the browser

4. New API surface

New company-scoped endpoints:

- `/api/companies/:companyId/plans`
- `/api/companies/:companyId/results`
- `/api/companies/:companyId/results/promote`
- `/api/companies/:companyId/briefings`
- `/api/companies/:companyId/briefings/board`

New shared record endpoints:

- `/api/records/:recordId`
- `/api/records/:recordId/links`
- `/api/records/:recordId/attachments`
- `/api/records/:recordId/generate`
- `/api/records/:recordId/publish`

5. Promotion flows from operational pages

Existing operational pages still matter, but now they can emit durable outputs:

- issue detail can promote to result
- approval detail can promote to result
- agent run detail can promote to result

This is one of the most important behavioral changes. It means the app no longer treats execution artifacts as the only place where meaning lives.

## Important correctness/security fixes bundled into that work

These were part of the final merged outcome, even though they arrived as review follow-ups:

1. Generic file upload hardening

- `/api/companies/:companyId/assets/files` now restricts uploads to inert document formats
- asset responses send `X-Content-Type-Options: nosniff`

Why this matters:

- the first version allowed arbitrary file MIME types
- that created a stored-XSS risk if users uploaded active content and opened it from the Paperclip origin

2. Project health aggregation fix

- board project health now uses the full blocker and decision collections before the visible board lists are truncated to top items

Why this matters:

- otherwise later projects in a busy company could incorrectly appear healthier than they are

3. Extra test coverage

New server-side tests now cover:

- record routes
- record service aggregation
- generic file upload behavior and headers

## Things that did not change

These are easy to misunderstand if you only glance at the UI:

- `/dashboard` was not replaced
  - it is still the narrow telemetry page
- issue detail is still the execution-oriented page
  - linked runs, comments, activity, and issue-level cost still live there
- automatic publishing into a future knowledge library was not added yet
- plans do not automatically explode into issues yet

## Other recent commits and what they mean

### `3db6e13 chore(lockfile): refresh pnpm-lock.yaml`

This is not a product feature. It is dependency lockfile maintenance from automation.

### `047a095 docs(dev-docs): add verified repository and branch maintenance snapshot`

This created the initial `DEV-DOCS/` folder for this workspace with a repo snapshot and branch notes.

### `0e5310e Merge branch 'codex/executive-briefings-results-layer' into development`

This moved the executive briefings work into the local `development` branch.

### `71a62da Merge remote-tracking branch 'origin/master' into development`

This synchronized `development` with the post-merge state of `master`, including the automated lockfile refresh.

## If you are staring at the app and not sure what to inspect

Start here:

1. Open `/dashboard`
   - treat it as telemetry and operational status only
2. Open `/briefings/board`
   - this is the new executive surface
3. Open `/briefings/results`
   - this shows the new durable output model
4. Open any issue / approval / agent run detail page
   - look for "Promote to result"
5. Open a record detail page under `/briefings/records/:recordId`
   - this shows what the new durable record UX actually looks like

## Practical reading of the app now

If you want the shortest possible explanation:

- Dashboard tells you what the system is doing.
- Issues tell you how work is being executed.
- Briefings tells you what changed and why it matters.

## What is still missing after that merge

The app is in a better state, but the executive layer is not finished yet. The missing pieces are the ones now targeted by the current sprint branch:

- a dedicated `Briefings` library view for briefing records themselves
- scheduled daily/weekly digest generation
- approval-aware decision synthesis inside generated briefings
- a knowledge library that durable results can publish into
- a portfolio/program board with milestones
- git-worktree-backed workspace isolation for parallel issue work
- wider use of truthful pricing states outside the board
