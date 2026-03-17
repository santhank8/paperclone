# Wish: Re-apply Multiuser Features After Upstream Merge

**Status:** SHIPPED
**Slug:** `reapply-multiuser-upstream`
**Created:** 2026-03-14

---

## Summary

After merging 96 upstream commits, two multiuser features were dropped to resolve conflicts cleanly: (1) human assignee support in IssueProperties, and (2) email/Resend config step in OnboardingWizard. These need to be re-applied on top of upstream's refactored code. Additionally, the NewIssueDialog never had human assignee support — that's a new bug to fix.

---

## Scope

### IN
- Re-apply human assignee dropdown to `IssueProperties.tsx` on top of upstream's "Assign to me" / "Unassigned" options
- Re-apply email/Resend config step to `OnboardingWizard.tsx` on top of upstream's refactored wizard
- Fix `NewIssueDialog.tsx` to include humans in the assignee dropdown (new bug)

### OUT
- Changes to upstream's token optimization or heartbeat-context endpoint
- Changes to upstream's comment pagination
- Any new multiuser features not previously shipped
- CompanyRail or account page changes (already merged cleanly)

---

## Decisions

- **DEC-1:** For IssueProperties, incorporate upstream's "Assign to me" / "Unassigned" quick options into our human-aware assignee picker — don't replace them. Use the existing `assignees.ts` helpers (`currentUserAssigneeOption`, `formatAssigneeUserLabel`) which survived the merge.
- **DEC-2:** For OnboardingWizard, upstream changed from 5 steps to 4 and refactored significantly. Re-apply our email config as an optional toggle within the existing flow. Save endpoint is `PATCH /admin/config/email` (not POST). Toggle defaults off; blank fields = skip.
- **DEC-3:** For NewIssueDialog, use the same `/api/companies/:id/people` endpoint and `assignees.ts` helpers to add human options alongside agent options.

---

## Success Criteria

- [ ] IssueProperties assignee dropdown shows both agents and humans (from `/people` endpoint)
- [ ] IssueProperties keeps upstream's "Assign to me" and "Unassigned" shortcuts
- [ ] Assigning an issue to a human user works end-to-end
- [ ] NewIssueDialog assignee selector includes human users
- [ ] OnboardingWizard has email/Resend config option (toggle + API key + from address)
- [ ] `pnpm -r typecheck && pnpm test:run && pnpm build` all pass

---

## Assumptions

- **ASM-1:** The `/api/companies/:id/people` endpoint still works and returns both agents and users
- **ASM-2:** The `assignees.ts` helpers (`currentUserAssigneeOption`, `parseAssigneeValue`, etc.) are still in the codebase and functional
- **ASM-3:** The `accessApi.listPeople` client function still exists

## Risks

- **RISK-1:** Upstream's IssueProperties may have changed the assignee popover structure significantly — Mitigation: read the current file before patching
- **RISK-2:** OnboardingWizard refactor may have changed how config is saved — Mitigation: read upstream's launch/save flow before adding email config

---

## Execution Groups

### Group A: Human Assignees in IssueProperties

**Depends on:** None (independent)

**Goal:** Re-apply human assignee support to the upstream-based IssueProperties.

**Deliverables:**
- Add `accessApi.listPeople` query back
- Add human users to the assignee popover options (below agents, with "People" section header)
- Keep upstream's "Assign to me" / "Unassigned" shortcuts
- Use `formatAssigneeUserLabel` for display

**Acceptance Criteria:**
- [ ] Assignee popover shows agents and humans
- [ ] "Assign to me" shortcut works
- [ ] Assigning to a human user persists correctly

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

### Group B: Human Assignees in NewIssueDialog

**Depends on:** None (independent)

**Goal:** Add human users to the new issue assignee selector.

**Deliverables:**
- Query `/people` endpoint in NewIssueDialog
- Add human options using `currentUserAssigneeOption` + people list
- Use `parseAssigneeValue` to split selection into `assigneeAgentId` / `assigneeUserId`

**Acceptance Criteria:**
- [ ] New issue dialog shows humans in assignee dropdown
- [ ] Creating an issue assigned to a human works

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

### Group C: Email Config in OnboardingWizard

**Depends on:** None (independent)

**Goal:** Re-apply email/Resend configuration step to the refactored onboarding wizard.

**Deliverables:**
- Add team mode toggle + Resend API key + from address fields
- Wire save to `PATCH /admin/config/email` endpoint
- Place within the wizard flow (read upstream's new structure to determine best placement)

**Acceptance Criteria:**
- [ ] Onboarding wizard has email config option with Resend fields
- [ ] Saving email config persists to instance config
- [ ] Skipping email config works: toggle defaults off, leaving Resend fields blank completes onboarding normally

**Validation:** `pnpm -r typecheck && pnpm test:run && pnpm build`

---

## Review Results

_Populated by `/review` after execution completes._

---

## Files to Create/Modify

```
# Group A
ui/src/components/IssueProperties.tsx — add people query + human assignee options

# Group B
ui/src/components/NewIssueDialog.tsx — add people query + human assignee options

# Group C
ui/src/components/OnboardingWizard.tsx — add email config section
```
