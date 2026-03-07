# NUG SOP Checklist

Status: practical board-operator checklist for running NUG with consistent quality and safety.

Use this together with:

- `doc/OPERATING-PLAYBOOK.md`
- `doc/AGENT-ROLE-TEMPLATES.md`
- `doc/MODEL-ROUTING-PROFILES.md`

## 1) Daily Start (Board Operator)

1. Confirm server health:
   - `curl http://localhost:3100/api/health`
   - `curl http://localhost:3100/api/companies`
2. Confirm no broken config from the previous day:
   - review PM, QA, and Release/Ops dashboards first
   - resolve or reroute stale blockers before opening new work
3. Confirm secrets and provider wiring:
   - Alibaba key is present in Company Settings
   - process agents have `MODEL_PROVIDER`, `MODEL_BASE_URL`, and `MODEL_NAME` set
4. Confirm the top 3 priorities with CEO before dispatching additional work.

## 2) Project Kickoff Flow (Required)

1. Open new initiative through CEO.
2. CEO requests planning from CTO, CPO, CSO.
3. CEO consolidates one execution plan.
4. PM decomposes work into assignable issues with:
   - one owner per issue
   - touch list
   - done criteria
   - verification notes
5. Builder executes.
6. QA verifies.
7. Release/Ops prepares rollout and rollback notes.
8. Board approves/rejects at checkpoint.

## 3) Skills Management SOP

Use `/:companyPrefix/skills` (for NUG: `/NUG/skills`).

1. Create skill with:
   - stable slug name
   - clear label
   - short description explaining when to use
   - markdown content (source of truth)
2. Scope rules:
   - use `all` only for universal operating/protocol skills
   - use role scopes for lane-specific skills (security, QA, release, etc.)
3. Assign from agent config:
   - open `/:companyPrefix/agents/:agent/configure`
   - in Skills, select required skills
   - save and confirm config persists
4. Change control:
   - avoid deleting commonly used skills during active execution
   - version by creating `-v2` slug if behavior changes materially

## 4) Prompt Optimization SOP

Use one prompt structure for all roles to reduce drift:

1. `Mission` (2-3 bullets)
2. `Accepts` (allowed inputs)
3. `May decide` (local authority)
4. `Must escalate` (hard boundaries)
5. `Output format` (Status, Evidence, Risks, Next action, Escalation)

Prompt quality rules:

- keep prompts role-scoped and operational, not motivational
- avoid long policy dumps inside role prompts; link to skills/docs instead
- explicitly ban destructive actions without approval
- require evidence in every completion update
- keep model temperature low for execution roles

When to optimize a prompt:

- repeated ambiguous responses
- repeated scope drift
- repeated missing evidence in handoffs
- repeated escalation failures

## 5) Security SOP (Local)

Run before merge:

1. Quality gates:
   - `pnpm -r typecheck`
   - `pnpm test:run`
   - `pnpm build`
2. Dependency audit:
   - `pnpm audit --audit-level high`
3. Secret hygiene:
   - do not commit `.env` or raw keys
   - use secret references for sensitive env values
   - enable strict mode outside trusted local use: `PAPERCLIP_SECRETS_STRICT_MODE=true`
4. Runtime safety:
   - no destructive command execution without explicit approval
   - require rollback notes for release-impacting changes

## 6) Security SOP (GitHub)

Required checks for every PR:

1. Confirm PR checks:
   - `gh pr checks <pr-number> --repo <owner>/<repo>`
2. Enforce branch protection on `master`:
   - require passing checks
   - require at least one review
   - block force pushes and direct pushes
3. Enable and monitor alerts:
   - Dependabot alerts
   - Code scanning alerts
   - secret scanning alerts
4. Weekly security review:
   - triage all open alerts
   - patch high/critical findings first
   - document accepted risk with expiry date

Useful commands (requires proper token scopes):

- `gh api "repos/<owner>/<repo>/dependabot/alerts?state=open&per_page=100"`
- `gh api "repos/<owner>/<repo>/code-scanning/alerts?state=open&per_page=100"`

## 7) Done Criteria For Board Sign-Off

A change is ready when all are true:

1. scope is still inside approved plan
2. evidence is attached and reproducible
3. QA status is explicit (pass/fail)
4. release/rollback notes exist for production-affecting work
5. high-severity security findings are resolved or formally accepted
