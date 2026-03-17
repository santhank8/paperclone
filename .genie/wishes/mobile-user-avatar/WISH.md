# Wish: Add User Avatar to Mobile Bottom Nav

**Status:** SHIPPED
**Slug:** `mobile-user-avatar`
**Created:** 2026-03-14

---

## Summary

On mobile, the CompanyRail (which holds the user avatar) is hidden. There's no way to access Account Settings or Sign Out from the mobile bottom nav. Add a user avatar button to the right side of the `MobileBottomNav` that opens a small menu with Account Settings and Sign Out.

---

## Scope

### IN
- Add user avatar as 6th item in `MobileBottomNav` (rightmost position)
- Show user's avatar image or initials (same as CompanyRail's `UserRailAvatar`)
- Tap opens dropdown/popover with "Account Settings" and "Sign Out"
- Grid changes from `grid-cols-5` to `grid-cols-6`

### OUT
- Moving existing nav items
- Adding the full CompanyRail to mobile
- Company switching on mobile
- Changes to desktop layout

---

## Decisions

- **DEC-1:** Add as a 6th column rather than replacing an existing item — all 5 current nav items are useful on mobile.
- **DEC-2:** Reuse the same auth session query and sign-out logic from `UserRailAvatar` in CompanyRail — extract into a shared hook or inline the same pattern.
- **DEC-3:** Use a `DropdownMenu` (same as desktop) for the menu — it works well on mobile touch targets. Menu opens upward (`side="top"`) from the bottom nav.
- **DEC-4:** Hide the avatar in `local_trusted` mode (no auth) — same as desktop behavior.

---

## Success Criteria

- [ ] Mobile bottom nav shows user avatar on the right side
- [ ] Tapping avatar opens menu with Account Settings and Sign Out
- [ ] Account Settings navigates to `/:prefix/account`
- [ ] Sign Out clears session and redirects to `/auth`
- [ ] Avatar shows photo or initials matching desktop
- [ ] Hidden in `local_trusted` mode
- [ ] `pnpm -r typecheck && pnpm test:run && pnpm build` all pass

---

## Assumptions

- **ASM-1:** The mobile breakpoint is `md` (768px) — `MobileBottomNav` only renders below this
- **ASM-2:** 6 columns still fit comfortably on a 390px-wide screen (65px per item)

## Risks

- **RISK-1:** 6 items may feel cramped on small screens — Mitigation: labels are `text-[10px]`, icons are 18px, 65px per column is adequate

---

## Execution Groups

### Group A: Add User Avatar to MobileBottomNav

**Depends on:** None

**Goal:** Add authenticated user's avatar as the rightmost item in the mobile bottom nav with a dropdown menu.

**Deliverables:**
- In `ui/src/components/MobileBottomNav.tsx`:
  - Import auth session query, health query, Avatar, DropdownMenu components
  - Add user avatar button after the Inbox item (6th position)
  - Change `grid-cols-5` to `grid-cols-6` when user is authenticated, keep `grid-cols-5` in `local_trusted` mode
  - Avatar button opens `DropdownMenu` with `side="top"` containing Account Settings + Sign Out
  - Use `useNavigate` for Account Settings, same sign-out logic as CompanyRail
  - Show avatar image or initials (derive from session user name)

**Acceptance Criteria:**
- [ ] Mobile bottom nav shows 6 items when authenticated
- [ ] Avatar with dropdown works (Account Settings + Sign Out)
- [ ] 5 items in `local_trusted` mode (no avatar)

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

## Files to Create/Modify

```
ui/src/components/MobileBottomNav.tsx — add user avatar + dropdown menu
```
