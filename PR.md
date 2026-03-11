# feat: add favorites — bookmark issues for quick access

## Summary

Adds a Favorites feature that lets board users bookmark issues and access them quickly from a dedicated sidebar view.

## What's changed

### Database
- New `issue_favorites` table with composite PK `(issue_id, user_id)`, cascade delete on issue removal, and an index on `(company_id, user_id)` for fast per-user queries
- Migration `0026_daffy_mauler.sql`

### API
- `GET /companies/:companyId/favorites` — returns favorited issues for the current user (full issue shape)
- `PUT /issues/:id/favorite` — add to favorites (idempotent upsert), writes activity log entry
- `DELETE /issues/:id/favorite` — remove from favorites, writes activity log entry
- `GET /companies/:companyId/issues` and `GET /issues/:id` now include `isFavoritedByMe: boolean` for board users, populated via a lightweight lookup against `issue_favorites`

### UI
- **Star icon** on each issue row in the list (outline on hover → filled yellow when favorited); clicking toggles without navigating away
- **Star button** in the `IssueDetail` header for favoriting from the detail view
- **Favorites page** (`/:company/favorites`) — flat list of all bookmarked issues using the existing `IssuesList` component, with an empty state when none are saved
- **Favorites nav item** added to the Work section in the sidebar (between Issues and Goals)

### Dev experience
- Changed `dev:watch` from `PAPERCLIP_MIGRATION_PROMPT=never` to `PAPERCLIP_MIGRATION_AUTO_APPLY=true` so new migrations are applied automatically on dev server restart instead of being silently skipped

## Notes
- Favorites are per-user and per-company; scoped and enforced server-side
- `isFavoritedByMe` query is wrapped in a try/catch — gracefully returns `false` if the migration hasn't been applied yet (no 500s on the issues list during first startup)
- No changes to existing issue query contracts; `isFavoritedByMe` is an additive optional field on the `Issue` type
