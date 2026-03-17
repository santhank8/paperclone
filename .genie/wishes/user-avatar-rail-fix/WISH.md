# Wish: Fix User Avatar, Add Crop Dialog, and Company Logo Upload

**Status:** IN_PROGRESS
**Slug:** `user-avatar-rail-fix`
**Created:** 2026-03-13

---

## Summary

The CompanyRail user avatar shows "US" initials and no photo because the server drops `name`/`email`/`image` from the session response. Additionally, avatar uploads (user and company) have no crop/resize step — users upload raw images that may be off-center or wrong aspect ratio. Fix the session data, add a circular crop dialog using `react-easy-crop`, and extend the same avatar upload + crop pattern to company logos in the CompanyRail.

---

## Scope

### IN
- Fix server session to propagate `name`, `email`, `image` (Group A)
- Add `react-easy-crop` dependency and reusable `AvatarCropDialog` component (Group B)
- Wire crop dialog into user avatar upload on Account page (Group B)
- Add `image` column to `companies` table for company logo (Group C)
- Add company logo upload endpoint mirroring user avatar upload (Group C)
- Show company logo in `CompanyPatternIcon` (fall back to pattern when no logo) (Group C)
- Add logo upload + crop to Company Settings page (Group C)

### OUT
- Changing CompanyRail placement (shipped in PR #10)
- Invite email auto-fill bug (separate wish)
- Company switching UX changes
- Theme toggle or docs link relocation
- Notification bell / presence indicators

---

## Decisions

- **DEC-1:** Fix session at server layer in `server/src/auth/better-auth.ts` — `resolveBetterAuthSessionFromHeaders` explicitly drops `image`. Frontend `toSession()` already handles it.
- **DEC-2:** Use `react-easy-crop` (~8KB gzip) for circular avatar crop — purpose-built for avatar UX, minimal API, provides crop area coordinates then canvas produces the final blob.
- **DEC-3:** Build one shared `AvatarCropDialog` component used by both user avatar and company logo upload — same circular crop + zoom slider UX.
- **DEC-4:** Add `image` text column to `companies` schema (nullable, stores relative URL like user avatars). `CompanyPatternIcon` shows the logo image when set, falls back to the generated pattern.
- **DEC-5:** Company logo upload route mirrors user avatar route: `POST /api/companies/:companyId/logo` with multer, storage service, and returns `logoUrl`.

---

## Success Criteria

- [ ] `GET /api/auth/get-session` returns `user.name`, `user.email`, and `user.image` with actual values for an authenticated user
- [ ] CompanyRail user avatar shows uploaded photo with correct initials fallback ("FR")
- [ ] User avatar upload on Account page opens circular crop dialog before uploading
- [ ] Company logo upload on Settings page opens same circular crop dialog
- [ ] CompanyRail shows company logo image when set, pattern icon when not
- [ ] `pnpm -r typecheck && pnpm test:run && pnpm build` all pass

---

## Assumptions

- **ASM-1:** Better Auth's internal `api.getSession()` already returns `image` in the user object — we just need to stop dropping it.
- **ASM-2:** The existing storage service and multer setup can serve company logos with the same pattern as user avatars.
- **ASM-3:** `react-easy-crop` works with the existing React 19 + Vite setup.

## Risks

- **RISK-1:** Better Auth may not include `image` in `getSession` — Mitigation: log raw `sessionValue` to verify.
- **RISK-2:** `react-easy-crop` may have React 19 compatibility issues — Mitigation: check npm for peer deps before installing.
- **RISK-3:** DB migration for `companies.image` — Mitigation: nullable text column, non-breaking addition.

---

## Execution Groups

### Group A: Fix Server Session Response

**Goal:** Make `resolveBetterAuthSessionFromHeaders` propagate `image` from Better Auth session user.

**Deliverables:**
- Add `image?: string | null` to `BetterAuthSessionUser` type (line 15-19)
- Add `image` to the cast type at lines 123-126
- Add `image: value.user.image ?? null` to user object construction at lines 130-135

**Acceptance Criteria:**
- [ ] `curl` to `get-session` returns `user.name`, `user.email`, `user.image` all non-null
- [ ] No regression in auth flow

**Validation:** `curl -s -b cookies.txt http://localhost:3100/api/auth/get-session | jq '.user | {name, email, image}'` — all non-null; `pnpm -r typecheck && pnpm test:run`

---

### Group B: AvatarCropDialog + User Avatar Crop

**Goal:** Add circular crop step to user avatar upload.

**Deliverables:**
- Install `react-easy-crop`
- Create `ui/src/components/AvatarCropDialog.tsx` — Dialog with circular crop area + zoom slider, returns cropped blob
- Wire into Account page: file input → crop dialog → upload cropped result

**Acceptance Criteria:**
- [ ] Selecting a file on Account page opens crop dialog with circular preview
- [ ] Zoom slider adjusts crop
- [ ] Confirm sends cropped circular image to `POST /users/me/avatar`
- [ ] Cancel closes dialog without uploading

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

### Group C: Company Logo Upload + CompanyRail Display

**Depends on:** Group B (reuses `AvatarCropDialog`)

**Goal:** Add logo/image support to companies, same UX as user avatar.

**Deliverables:**
- Add `image` text column to `companies` schema + migration
- Add `POST /api/companies/:companyId/logo` endpoint (mirrors user avatar upload pattern in `server/src/routes/users.ts`)
- Add `GET /api/companies/logos/*` serve endpoint (same pattern as `GET /users/avatars/*` in `server/src/routes/users.ts`)
- Update `CompanyPatternIcon` to show logo image when `company.image` is set
- Add logo upload + crop to Company Settings page
- Export `image` in shared Company type

**Acceptance Criteria:**
- [ ] Company Settings page has logo upload with crop dialog
- [ ] Uploaded logo appears in CompanyRail instead of pattern icon
- [ ] Companies without logo still show pattern icon
- [ ] `Company` type includes `image` field

**Validation:** `pnpm db:generate && pnpm -r typecheck && pnpm test:run && pnpm build`

---

## Review Results

_Populated by `/review` after execution completes._

---

## Files to Create/Modify

```
# Group A
server/src/auth/better-auth.ts — add image to BetterAuthSessionUser + resolveBetterAuthSessionFromHeaders

# Group B
ui/package.json — add react-easy-crop dependency
ui/src/components/AvatarCropDialog.tsx — NEW: reusable circular crop dialog
ui/src/pages/Account.tsx — wire crop dialog into avatar upload

# Group C
packages/db/src/schema/companies.ts — add image column
packages/shared/src/types/company.ts — add image field to Company interface
server/src/routes/companies.ts — add logo upload + serve endpoints
ui/src/components/CompanyPatternIcon.tsx — show logo when image is set
ui/src/pages/CompanySettings.tsx — add logo upload with crop
```
