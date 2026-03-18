# Humans & Permissions — Completion PR

Status: Ready to implement
Date: 2026-03-17
Branch: feature/human-invite-ui
Companion plans: `doc/plans/2026-02-21-humans-and-permissions.md`,
                 `doc/plans/2026-02-21-humans-and-permissions-implementation.md`

## Scope

This PR closes the remaining open items from the humans-and-permissions plan that are
required before the feature is considered complete enough for upstream PR submission.

The existing branch already delivers:
- Better Auth integration and `authenticated` deployment mode
- All DB schema: `invites`, `join_requests`, `principal_permission_grants`,
  `instance_user_roles`, `company_memberships` extensions, `issues.assignee_user_id`,
  `agents.reports_to_user_id`
- Full invite → accept → pending join → approve/reject backend
- `tasks:assign`, `agents:create`, `users:invite`, `joins:approve` permission checks
  on their respective routes
- Auth UI (`Auth.tsx`), bootstrap pending screen, invite landing, inbox join approvals
- CLI `auth-bootstrap-ceo` and `onboard` commands
- Human pages (`Humans`, `HumanDetail`, `SidebarHumans`)

The four remaining items are delivered together in this PR.

---

## Tasks

Tasks marked **[parallel]** have no dependency on each other and can be done
simultaneously. Tasks marked **[requires: N]** must wait for task N to complete first.

---

### Task 1 — Add XOR single-assignee refine to issue validators [parallel]

**File:** `packages/shared/src/validators/issue.ts`

Extract the assignee fields into a base schema and add a `.superRefine()` that errors
when both `assigneeAgentId` and `assigneeUserId` are non-null. Apply the refine to
both `createIssueSchema` and `updateIssueSchema` (via the shared base before
`.partial()`).

Error shape: `ZodIssueCode.custom`, path `["assigneeUserId"]`, message
`"assigneeAgentId and assigneeUserId are mutually exclusive"`.

Acceptance criteria:
- Both fields set → ZodError with path `assigneeUserId`
- Either field set alone → parses correctly
- Neither field set → parses correctly

---

### Task 2 — Add local trusted mode badge to sidebar [parallel]

**File:** `ui/src/components/Layout.tsx`

`Layout.tsx` already has `health?.deploymentMode` in scope. Add a small pill near the
sidebar footer that renders only when `deploymentMode === "local_trusted"`. The pill
should contain a green dot and the text "Local trusted mode". Follow existing sidebar
footer styling conventions. Must not appear in `authenticated` mode.

Acceptance criteria:
- Badge visible in `local_trusted` build
- Badge absent in `authenticated` build
- No layout shift or overflow on narrow sidebar widths

---

### Task 3 — Add `parseAssignmentScope` and `evaluateAssignmentScope` pure functions [parallel]

**File:** `server/src/services/access.ts`

Add as module-level exports (outside the `accessService` factory):

```ts
export type AssignmentScopeRule =
  | { type: "subtree"; anchorId: string }
  | { type: "exclude"; targetId: string };

export function parseAssignmentScope(
  raw: Record<string, unknown> | null | undefined,
): AssignmentScopeRule[]

export function evaluateAssignmentScope(
  rules: AssignmentScopeRule[],
  assigneeId: string,
  ancestors: string[],
): { allowed: boolean; reason?: string }
```

`parseAssignmentScope`: expects `{ rules: [...] }` shape; returns `[]` on null,
undefined, or unrecognised input — never throws.

`evaluateAssignmentScope`: empty rules → allowed. `subtree` rule passes if
`anchorId === assigneeId` or `anchorId` is in `ancestors`. `exclude` rule fails if
`targetId === assigneeId`. All subtree rules must pass; any exclude failure denies.

No DB access — pure functions only.

---

### Task 4 — Add `resolveAssigneeAncestors` and `getPermissionGrant` to `accessService` [requires: 3]

**File:** `server/src/services/access.ts`

Add to the `accessService` factory and include in its return object:

`resolveAssigneeAncestors(companyId, assigneeType: "agent" | "user", assigneeId)`:
- Agent: walk `agents.reports_to` upward, capped at 20 hops to prevent cycles.
- User: walk `company_memberships.supervisor_agent_id` / `supervisor_user_id` upward,
  same cap.
- Returns ancestor IDs ordered from direct parent to root. Returns `[]` when no
  hierarchy data exists.

`getPermissionGrant(companyId, principalType, principalId, permissionKey)`:
- Returns the full `principal_permission_grants` row (including `scope`) or `null`.
- Used by the route to read the scope payload without a separate query.

---

### Task 5 — Wire scope enforcement into `assertCanAssignTasks` [requires: 4]

**File:** `server/src/routes/issues.ts`

After the existing grant-existence check passes in `assertCanAssignTasks`, fetch the
full grant row via `access.getPermissionGrant`. If `grant.scope` is non-null, call
`parseAssignmentScope` then `evaluateAssignmentScope` with the ancestors resolved via
`access.resolveAssigneeAncestors`. Throw `forbidden` with the evaluator's reason on
denial.

Scope enforcement only triggers when the grant row has a non-null `scope` payload with
parseable rules. Null-scope grants are unaffected. The existing local-implicit and
instance-admin short-circuits at the top of `assertCanAssignTasks` remain and bypass
scope entirely.

Acceptance criteria:
- `subtree:X` scope: can assign to X and X's reports → 200; outside subtree → 403
- `exclude:CEO-id`: cannot assign to CEO → 403
- Null-scope `tasks:assign`: can assign anywhere → 200
- Local implicit admin and instance admin bypass scope → 200

---

### Task 6 — Write test: issue assignee XOR validator [requires: 1]

**File:** `server/src/__tests__/issue-assignee-xor.test.ts`

Unit tests against the shared validator (no HTTP, no DB):

- `createIssueSchema` with both assignee fields → ZodError, path `assigneeUserId`
- `createIssueSchema` with only `assigneeAgentId` → succeeds
- `createIssueSchema` with only `assigneeUserId` → succeeds
- `updateIssueSchema` with both assignee fields → ZodError

---

### Task 7 — Write test: assignment scope pure functions [requires: 3]

**File:** `server/src/__tests__/assignment-scope.test.ts`

Unit tests against `parseAssignmentScope` and `evaluateAssignmentScope` (no HTTP,
no DB):

- `parseAssignmentScope(null)` → `[]`
- `parseAssignmentScope` with valid shape → typed rules
- `parseAssignmentScope` with unrecognised shape → `[]` (no throw)
- `evaluateAssignmentScope([], ...)` → allowed
- `subtree` rule: assignee is anchor → allowed
- `subtree` rule: anchor in ancestors → allowed
- `subtree` rule: anchor not in ancestors and not assignee → denied
- `exclude` rule: targetId matches assignee → denied
- `exclude` rule: targetId does not match → allowed
- Combined: subtree passes, exclude fails → denied

---

### Task 8 — Write test: auth mode guard [parallel]

**File:** `server/src/__tests__/auth-mode-guard.test.ts`

Tests `actorMiddleware` + `boardMutationGuard` in `authenticated` mode using
in-process express stubs (follow pattern in `board-mutation-guard.test.ts`):

- No bearer, no session → mutation endpoint returns 401 or 403
- Valid agent bearer → actor resolves, company access check passes
- Valid session with matching `companyIds` → actor resolves, passes
- Session user accessing a company not in their `companyIds` → 403

---

### Task 9 — Write test: cross-company access guard [parallel]

**File:** `server/src/__tests__/cross-company-access.test.ts`

Tests `assertCompanyAccess` via in-process express stubs:

- Board actor (`source: "session"`, `companyIds: ["co-1"]`) accessing `co-2` → 403
- Board actor with `isInstanceAdmin: true` accessing any company → passes
- Agent actor with `companyId: "co-1"` accessing `co-1` → passes
- Agent actor with `companyId: "co-1"` accessing `co-2` → 403

---

## Dependency graph

```
Task 1 ──────────────────────────────► Task 6
Task 2 (no dependents)
Task 3 ──► Task 4 ──► Task 5
       └──────────────────────────────► Task 7
Task 8 (no dependencies)
Task 9 (no dependencies)
```

Tasks 1, 2, 3, 8, 9 can all start at the same time.
Task 4 starts after Task 3 completes.
Task 5 starts after Task 4 completes.
Task 6 starts after Task 1 completes.
Task 7 starts after Task 3 completes.

---

## Verification gate

Before marking the PR ready:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

All three must pass clean. No skips without documented justification.

---

## Done criteria (maps to plan acceptance criteria)

- Passing both `assigneeAgentId` and `assigneeUserId` returns a validation error.
- UI shows "Local trusted mode" badge in local builds; badge absent in authenticated builds.
- Principal with scoped `tasks:assign` grant cannot assign outside their permitted subtree.
- Unauthenticated mutations in `authenticated` mode return 401/403.
- Cross-company access returns 403 for non-admin user actors.
- All new code passes typecheck, existing tests remain green.
