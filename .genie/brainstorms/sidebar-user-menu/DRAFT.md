# Brainstorm: Move User Avatar to CompanyRail Bottom

## Problem
User menu is buried at sidebar bottom with wrong name ("US User" instead of initials from "Felipe Rosa"), no avatar shown, and the Account page renders outside the Layout (no sidebar/rail).

## Decisions Made
1. **Placement**: User avatar circle goes at the bottom of the `CompanyRail` (far-left strip), below the "+" add-company button — mirrors the pattern: Paperclip logo (top) → companies → add → separator → user avatar (bottom)
2. **Trigger**: Click avatar → small dropdown with "Account Settings" + "Sign Out"
3. **Avatar display**: Show uploaded avatar image if available, otherwise show initials derived from user's actual name (e.g., "FR" for Felipe Rosa)
4. **Remove from sidebar**: Delete the `<UserMenu />` and its `border-t` wrapper from `Sidebar.tsx`
5. **Account page inside Layout**: Move the `/account` route inside the `<Layout />` wrapper so it renders with sidebar/rail

## Scope

### IN
- Add user avatar + dropdown to `CompanyRail.tsx` bottom (between separator and bottom padding)
- Fix `AuthSession` type and `UserMenu` to include `image` field from session
- Fix initials: use actual `session.user.name` not fallback
- Move `/account` route inside the `<Layout />` component
- Remove `<UserMenu />` from `Sidebar.tsx`

### OUT
- Company switching UX changes
- Theme toggle relocation
- Documentation link relocation
- Notification bell / presence indicators

## Bugs to Fix (concurrent)
1. "US User" — the `authApi.getSession()` returns the name but `UserMenu` falls back to "User" when name is null. The real name IS there ("Felipe Rosa") but the session `toSession()` might not be extracting `image`. Need to propagate `image` through the session type.
2. Account page layout — `/account` route at line 238 of `App.tsx` is a sibling of the `<Layout />` route, not nested inside it.

## Files to Modify
- `ui/src/components/CompanyRail.tsx` — add user avatar + dropdown at bottom
- `ui/src/components/Sidebar.tsx` — remove UserMenu section
- `ui/src/components/UserMenu.tsx` — delete or gut (logic moves to CompanyRail)
- `ui/src/api/auth.ts` — add `image` to `AuthSession.user`
- `ui/src/App.tsx` — move `/account` route inside `<Layout />`

## Status
WRS: 80/100 — Problem, Scope, Decisions, Risks clear. Need acceptance criteria.
