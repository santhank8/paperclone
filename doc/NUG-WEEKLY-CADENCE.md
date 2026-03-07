# NUG Weekly Operations Cadence

Status: canonical Mon–Fri board-operator routine for running NUG on Paperclip.

This cadence assumes:
- Server runs at `http://localhost:3100`
- Company ID: `b17a1f7d-456f-4afa-a436-c7d45f7ec8b1`
- Company prefix: `NUG`
- Worker: `~/.paperclip/workers/multi_model_worker.py`
- Fork branch: `ai/paperclip/2026-03-07-scoped-skills-runtime` on `kin0kaze23/paperclip`

See also: `doc/NUG-SOP-CHECKLIST.md`, `doc/OPERATING-PLAYBOOK.md`, `doc/AGENT-ROLE-TEMPLATES.md`

---

## Monday — Review + Plan

### Goal
Restart the week with clear context. Resolve carry-overs. Set the top 3 priorities.

### Commands

```bash
# 1. Confirm server is up
curl -s http://localhost:3100/api/health | jq .

# 2. List all NUG agents (confirm all 8 are active)
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '[.[] | {name, status, role}]'

# 3. Review open issues (todo + blocked + in_progress)
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=todo,in_progress,blocked" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '[.[] | {identifier, title, status, priority, assignee: .assigneeAgent.name}]'

# 4. Triage any stale blocked issues (manually inspect and re-route if needed)
# Rule: if an issue has been blocked for more than 24h with no comment, escalate to CEO.

# 5. Open board UI and confirm top-of-queue
open http://localhost:3100/NUG
```

### Checklist
- [ ] Server is healthy
- [ ] All 8 agents show status `active`
- [ ] No issues have been stuck in `blocked` for > 24h without a comment
- [ ] Top 3 priorities are confirmed with CEO before any execution starts

---

## Tuesday — Execution Day 1

### Goal
Run the highest-priority in-scope execution work. Builder and PM are the primary active agents.

### Commands

```bash
# 1. Confirm issue queue is ready (all active issues have owners and clear criteria)
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=todo,in_progress" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '.[] | {identifier, title, assignee: .assigneeAgent.name, priority}'

# 2. Trigger a heartbeat for the CEO (strategic review + issue handoff)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/890a1295-ebc4-4b01-8499-2856ea108bc6/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 3. After CEO heartbeat, check for newly created subtasks
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=todo" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '.[] | {identifier, title, assignee: .assigneeAgent.name}'

# 4. Trigger PM heartbeat (task decomposition and assignment)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/33b205e5-be1e-4a0d-bb1b-c9ed34bf1920/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 5. Trigger BuilderEngineer heartbeat (implementation)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/73e4d6f5-b349-4cf3-9233-90a7bbbea5f5/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 6. Run local quality gates (if Builder claims any implementation is complete)
cd ~/Documents/Personal\ Projects/Paperclip
pnpm -r typecheck && pnpm test:run && pnpm build
```

### Checklist
- [ ] CEO heartbeat completed (produced delegation comment or created subtasks)
- [ ] PM heartbeat completed (active issues have owner + done criteria)
- [ ] Builder heartbeat completed (evidence posted in issue comment)
- [ ] Quality gates pass if any code was changed

---

## Wednesday — Verification + Security

### Goal
QA verifies Tuesday's execution. CSO reviews any security-sensitive changes. No new execution starts until verification is resolved.

### Commands

```bash
# 1. Trigger QA heartbeat (verify completed Builder work)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/d630e613-7282-4fae-9874-41f3eab9dea5/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 2. Trigger CSO heartbeat (security/privacy risk review)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/276b01b3-d84b-4c6d-b02e-93f0d3abbb72/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 3. Run dependency security audit
pnpm audit --audit-level high

# 4. Review GitHub PR checks (if any PRs are open)
gh pr checks 178 --repo kin0kaze23/paperclip

# 5. Triage open security alerts
gh api "repos/kin0kaze23/paperclip/dependabot/alerts?state=open&per_page=100" | jq '[.[] | {number, severity: .security_advisory.severity, package: .dependency.package.name, summary: .security_advisory.summary}]'

# 6. If QA fails, route back to Builder via issue update
# curl -s -X PATCH "http://localhost:3100/api/issues/<ISSUE_ID>" \
#   -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"status": "blocked", "comment": "QA returned: <reason>"}'
```

### Checklist
- [ ] QA heartbeat completed (pass/fail verdict with evidence in comment)
- [ ] CSO heartbeat completed (risk classification posted)
- [ ] No HIGH/CRITICAL dependency vulnerabilities open
- [ ] All PR checks green (or known failures documented with ticket)

---

## Thursday — Release Prep + CTO/CPO Reviews

### Goal
Prepare any QA-approved work for release. CTO reviews technical debt or architecture risks. CPO confirms product quality.

### Commands

```bash
# 1. Trigger CTO heartbeat (technical decomposition, risk review, architecture sign-off)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/d2a8a962-61a2-4b7e-9ddc-830fae5b1e3e/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 2. Trigger CPO heartbeat (acceptance criteria and UX quality review)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/05911a19-fe2c-44db-907a-3e7433b40d61/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 3. Trigger ReleaseOps heartbeat (prepare rollout + rollback notes)
curl -s -X POST "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents/0e46fd71-30c6-4d27-a7fc-8de2eac97588/heartbeat" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 4. Confirm release candidate issues are in_review or done
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=in_review,done" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '[.[] | {identifier, title, status}]'

# 5. Review token costs for the week (budget check)
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/costs" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq .
```

### Checklist
- [ ] CTO heartbeat completed (technical risk documented)
- [ ] CPO heartbeat completed (acceptance criteria confirmed or updated)
- [ ] ReleaseOps heartbeat completed (rollout + rollback plan in comment)
- [ ] Budget is within threshold (no runaway cost event)

---

## Friday — Board Sign-Off + Reset

### Goal
Approve completed work. Archive done issues. Prepare context for next week.

### Commands

```bash
# 1. Final board review of all done/in_review issues
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=done,in_review" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '[.[] | {identifier, title, status}]'

# 2. Board sign-off: mark any in_review issues as done if all criteria pass
# (Must confirm: scope, evidence, QA verdict, rollback notes, no open HIGH security findings)
# curl -s -X PATCH "http://localhost:3100/api/issues/<ISSUE_ID>" \
#   -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"status": "done", "comment": "Board approved. Evidence reviewed, criteria met."}'

# 3. Weekly security review (triage any new alerts since Monday)
gh api "repos/kin0kaze23/paperclip/dependabot/alerts?state=open&per_page=100" | \
  jq '[.[] | select(.security_advisory.severity == "high" or .security_advisory.severity == "critical") | {number, severity: .security_advisory.severity, package: .dependency.package.name}]'

# 4. Review agent quality this week — did agents follow the output format?
# Manually inspect: did each heartbeat comment include Status/Evidence/Risks/Next action/Escalation?
# If not, note which role drifted and when. Update prompt if it happens > 2x in a week.
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues?status=done" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq '.[0].comments // [] | .[-3:] | .[].body' 2>/dev/null || true

# 5. Run full validation suite (confirm the codebase is clean going into the weekend)
cd ~/Documents/Personal\ Projects/Paperclip
pnpm -r typecheck && pnpm test:run && pnpm build && pnpm audit --audit-level high

# 6. Push any local changes to fork branch
cd ~/Documents/Personal\ Projects/Paperclip
git add -A
git status
# Review staged changes before committing:
# git commit -m "chore(nug): weekly ops and doc updates"
# git push origin ai/paperclip/2026-03-07-scoped-skills-runtime

# 7. Capture lessons and context for next week
# If anything broke or was surprising this week, log it:
# bash .agent/scripts/stewardctl.sh lesson <category> "<title>" "<lesson>" "<cause>" "<fix>" "<prevention>"
```

### Checklist
- [ ] All in-review work is either approved (done) or returned with a clear reason
- [ ] No unresolved HIGH/CRITICAL security alerts
- [ ] Full quality gate pass (`typecheck`, `test`, `build`, `audit`)
- [ ] Any new lessons captured before closing the week
- [ ] Server is left healthy for Monday

---

## Weekly Snapshot Commands (run any day)

```bash
# Full agent roster status
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/agents" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | \
  jq '[.[] | {name, role, status, model: .adapterConfig.env.MODEL_NAME.value}]'

# All issues by status summary
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/issues" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'

# Cost events this week
curl -s "http://localhost:3100/api/companies/b17a1f7d-456f-4afa-a436-c7d45f7ec8b1/costs" \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" | jq .

# Server health
curl -s http://localhost:3100/api/health | jq .

# Worker dry-run check (no issue processed, just confirm it can start)
PAPERCLIP_API_URL=http://localhost:3100 \
  PAPERCLIP_API_KEY=$PAPERCLIP_BOARD_TOKEN \
  PAPERCLIP_COMPANY_ID=b17a1f7d-456f-4afa-a436-c7d45f7ec8b1 \
  PAPERCLIP_AGENT_ID=890a1295-ebc4-4b01-8499-2856ea108bc6 \
  MODEL_NAME=qwen3.5-plus \
  MODEL_BASE_URL=https://coding-intl.dashscope.aliyuncs.com/v1 \
  ALIBABA_API_KEY=$ALIBABA_API_KEY \
  AGENT_SYSTEM_PROMPT="You are the CEO of this Paperclip company." \
  python3 ~/.paperclip/workers/multi_model_worker.py 2>&1 | head -20
```

---

## Escalation Decision Tree

```
Agent produced no output (silent heartbeat)
  └─ Check server log for HTTPError or timeout
  └─ Re-trigger heartbeat with ENABLE_TOOL_USE=false as a fallback

Agent output missing Status/Evidence/Risks/Next action/Escalation
  └─ Count occurrences this week
  └─ 1x → note it
  └─ 2x+ → update AGENT_SYSTEM_PROMPT to be more explicit about format

Agent repeated the same action without progress
  └─ Manually inspect issue context and comments
  └─ Add a board comment clarifying the expectation
  └─ If still stuck after 2 retries → reassign to a different role

Issue stuck in blocked for > 48h
  └─ Escalate to CEO manually with a board comment
  └─ CEO should resolve blocker or cancel the issue

Cost event spike (> 2x normal)
  └─ Check if MAX_TOOL_TURNS was hit (model looping)
  └─ Check if the issue context was unusually large
  └─ Set MAX_TOOL_TURNS=5 temporarily and re-run
```

---

## Key IDs Reference

| Item | Value |
|------|-------|
| Company ID | `b17a1f7d-456f-4afa-a436-c7d45f7ec8b1` |
| Server URL | `http://localhost:3100` |
| CEO | `890a1295-ebc4-4b01-8499-2856ea108bc6` |
| CTO | `d2a8a962-61a2-4b7e-9ddc-830fae5b1e3e` |
| CPO | `05911a19-fe2c-44db-907a-3e7433b40d61` |
| CSO | `276b01b3-d84b-4c6d-b02e-93f0d3abbb72` |
| PM | `33b205e5-be1e-4a0d-bb1b-c9ed34bf1920` |
| BuilderEngineer | `73e4d6f5-b349-4cf3-9233-90a7bbbea5f5` |
| QAEngineer | `d630e613-7282-4fae-9874-41f3eab9dea5` |
| ReleaseOps | `0e46fd71-30c6-4d27-a7fc-8de2eac97588` |
| Fork branch | `ai/paperclip/2026-03-07-scoped-skills-runtime` |
| Fork repo | `kin0kaze23/paperclip` |
| PR | `#178` |
