# Task List

Last updated: 2026-03-09

## Done

- Ship the first executive record layer:
  - `records`, `record_links`, `record_attachments`, `briefing_view_states`
  - `/briefings/board`, `/briefings/results`, `/briefings/plans`
  - shared record detail page
  - promotion to result from issue, approval, and run detail pages
- Harden generic file upload behavior for inert document types and `nosniff`
- Fix project-health aggregation on the executive board
- Add baseline DEV-DOCS snapshot for repo state and recent merged changes

## Partial

- Phase 2:
  - briefing records and manual generation exist
  - board summary exists
  - missing: briefing library, schedule system, explicit approval-driven decision context, kind-specific digest generation, polished publish workflow
- Phase 4:
  - board includes a lightweight `projectHealth` section
  - missing: dedicated portfolio/program page and milestone model
- Phase 5:
  - `pricingState` exists on the board
  - missing: project/issue/portfolio propagation, attribution cleanup across new flows, worktree isolation

## Next

- Add DB/shared contracts for:
  - `briefing_schedules`
  - `knowledge_entries`
  - `project_milestones`
  - `workspace_checkouts`
- Add briefing library and portfolio routes in the UI
- Add knowledge routes and publication flow
- Add briefing scheduler loop and generation-window controls
- Add milestone CRUD and portfolio aggregation endpoint
- Add checkout-aware workspace resolution and operator visibility

## Later

- External delivery for briefings and alerts
  - Slack
  - email
  - Discord
  - webhooks beyond current event layer
- richer knowledge retrieval/search
- automated plan-to-issue decomposition
- broader multi-operator governance beyond current board model
