# NUG Agent Quality Evaluation

Status: post-implementation evaluation of all agent quality levers for NUG.
Reviewed: 2026-03-07

This document evaluates the full agent execution stack — worker, role framing, system prompts,
skills, tools, and configuration — and produces ranked recommendations.

---

## 1) Worker Script (`multi_model_worker.py`)

### Strengths
- Python 3.9 compatible with `from __future__ import annotations`
- `urllib` only — no external dependencies, always runnable
- Clean tool-use loop up to `MAX_TOOL_TURNS`
- Token usage extraction handles both `prompt_tokens` and `input_tokens` naming variants
- `resolve_model_api_key()` auto-detects the right env var — no config fragility
- `choose_issue()` correctly prioritizes by `PRIORITY_ORDER` then `createdAt`
- `MODEL_EXTRA_HEADERS_JSON` escape hatch for provider quirks
- `AUTO_CLOSE_ISSUE` guard prevents silent auto-close

### Gaps and Recommendations

**G1 — `paperclip_update_issue` mutates `tool_args` in place** (BUG — MEDIUM)
```python
elif tool_name == "paperclip_update_issue":
    issue_id = tool_args.pop("issue_id")   # mutates the dict
```
If this dict is referenced elsewhere this causes silent data loss. Fix: copy first.
```python
args = dict(tool_args)
issue_id = args.pop("issue_id")
```

**G2 — No retry on transient HTTP failures** (MEDIUM)
`paperclip_request` raises immediately on any non-2xx. A single 502/503 from the server
kills the heartbeat. Recommend: retry with exponential backoff (2×, max 3 attempts)
for 429, 502, 503, 504.

**G3 — No companyId injection into `paperclip_get_issue`** (LOW)
The `GET /api/issues/:id` endpoint returns the full issue but does not validate company
scope in the worker. If someone passes a cross-company issue ID there is no guard.
Recommend: pass `X-Paperclip-Company-Id` header on every request.

**G4 — `PAPERCLIP_AGENT_NAME` falls back to `agent_id`** (LOW UX)
Comment headers read `## b17a1f7d-... (qwen3-coder-plus)` when the name is not injected.
The server already has the agent name. Recommend: Paperclip server injects
`PAPERCLIP_AGENT_NAME` from the agent record automatically (tracked in Paperclip.md).

**G5 — No timeout logging** (LOW)
When `urllib.request.urlopen` hits its timeout it raises `socket.timeout`, which is
caught by the outer `except Exception` in `main()` with no identification. Add:
```python
except socket.timeout as exc:
    log(f"Timeout: {exc}")
    raise
```

**G6 — Temperature default is 0.2 for all roles** (MEDIUM)
The worker uses a single `MODEL_TEMPERATURE=0.2` default for all 8 roles.
Strategic roles (CEO, CPO, CSO) benefit from slightly higher temperature (0.3–0.4)
for better synthesis; execution roles (Builder, QA, ReleaseOps) need strict determinism
(0.1). Recommend: make temperature role-aware or document the per-role env var override.

---

## 2) Role Framing (`ROLE_FRAMING` in worker)

The 8 framing prompts each follow the same 4-step pattern:
1. Read the issue
2. Take the role-specific action
3. Delegate or update
4. Post structured comment

### Assessment by Role

| Role | Quality | Issue |
|------|---------|-------|
| CEO | Good | Correctly specifies delegation to CTO/CPO/CSO/PM |
| CTO | Good | Correctly routes to BuilderEngineer |
| CPO | Good | Acceptance criteria focus is clear |
| CSO | Good | Risk classification + blocking is explicit |
| PM | Good | Subtask creation and assignment is explicit |
| Builder | **Weak** | Step 3 says "update issue to done or blocked" but gives no criteria for when each applies |
| QA | **Weak** | Says "verify the work meets acceptance criteria" but does not say how to find the criteria |
| ReleaseOps | **Weak** | Says "prepare rollout and rollback plan" but does not say where to post or what format |

### Recommendations

**R1 — Builder role framing: add explicit evidence expectation** (HIGH)
Current step 2: "Report implementation status and evidence"
Replace with:
```
2. Attach evidence: list every file changed, every test run, and the output of `pnpm -r typecheck && pnpm test:run`. If you cannot run tests, state why.
```

**R2 — QA role framing: say where acceptance criteria live** (HIGH)
Current step 2: "Verify the work meets acceptance criteria"
Replace with:
```
2. Find acceptance criteria in: (a) the issue description, (b) CPO comments on the issue,
   (c) parent issue. If no acceptance criteria exist, comment asking PM to provide them
   and set status=blocked.
```

**R3 — ReleaseOps: specify rollout comment format** (MEDIUM)
Add to step 2:
```
Post a rollout comment with:
  - Deployment steps (ordered)
  - Rollback steps (ordered)
  - Environment prerequisites
  - Risk level: low/medium/high
```

**R4 — CSO: add explicit safe-harbor clause** (LOW)
Add to step 3:
```
3. If the change is low risk, explicitly state "No blocking concerns." so QA and ReleaseOps
   can proceed without waiting.
```

---

## 3) System Prompts (`AGENT_SYSTEM_PROMPT` per agent)

From `doc/AGENT-ROLE-TEMPLATES.md`, all 8 prompts follow the identical 5-section structure:
Mission / Accepts / May decide / Must escalate / Output format.

### Assessment

The prompts are deliberately minimal, which is correct. But they have two recurring gaps:

**P1 — Output format is listed but not enforced** (HIGH)
Every prompt says:
```
Output format:
- Status
- Evidence
- Risks
- Next action
- Escalation
```
But this is a list, not an example. Models treat lists as optional unless forced.
Recommend: add one concrete example comment for each role, or at minimum add:
```
Every comment MUST use these exact headers in this order.
Do not omit any section, even if the content is "N/A".
```

**P2 — No distinction between heartbeat and delegation modes** (MEDIUM)
All prompts assume the agent is processing its own assigned issue. But CEO and CTO
regularly need to create and delegate subtasks. These roles need a second mode:
```
If no issue is assigned to you but the queue has unowned work, pick the highest-priority
unowned issue, delegate it to the correct lane owner, and comment your reasoning.
```

**P3 — No instruction to avoid hallucinating agent IDs** (HIGH)
The CEO and PM delegate work by assigning issues to agents. Without seeing the real agent
list, they will hallucinate agent IDs. The `paperclip_list_agents` tool exists for this,
but the system prompt does not mention it. Add:
```
Always call paperclip_list_agents before assigning or creating issues to confirm agent IDs.
Never guess or invent an agent UUID.
```

---

## 4) Skills Coverage

### Current State

| Skill | Covers | Assigned to |
|-------|--------|-------------|
| `paperclip` | Heartbeat protocol, API reference, checkout flow, output format, escalation | All 8 |
| `paperclip-create-agent` | Agent hiring + governance | CEO, CTO |
| `para-memory-files` | PARA file-based memory system | None (not assigned to any NUG agent) |
| `create-agent-adapter` | Adapter development | None (not relevant to NUG) |

### Gaps

**S1 — No QA skill** (HIGH)
The QA role has zero role-specific guidance. A dedicated QA skill should cover:
- How to read and evaluate evidence from Builder comments
- What constitutes a passing vs. failing evidence bundle
- How to write a reproducible defect report in Paperclip (comment format)
- When to escalate vs. return vs. block

**S2 — No security-review skill for CSO** (HIGH)
The CSO has only the generic `paperclip` skill. A `security-review` skill should cover:
- Threat model checklist (OWASP top 10 applied to Paperclip changes)
- Required checks per change type (auth, DB schema, file upload, API key handling)
- How to write a risk classification comment
- What constitutes HIGH vs. MEDIUM vs. LOW risk in this codebase

**S3 — No release-ops skill** (MEDIUM)
ReleaseOps has only `paperclip`. A `release-ops` skill should cover:
- Release readiness checklist (QA pass + no open HIGH security + rollback ready)
- How to write a rollout comment (exact format)
- pnpm audit + typecheck + build gates expected before release
- How to signal a blocked release vs. a packaged one

**S4 — `para-memory-files` is unassigned** (LOW)
This skill enables agents to write persistent memory files across sessions, which is
especially useful for CEO and PM to track context across weekly cycles. Assigning it
to CEO and PM would allow them to maintain a running weekly context file.

**S5 — No `builder-engineering` skill** (MEDIUM)
BuilderEngineer has only `paperclip`. A `builder-engineering` skill should cover:
- How to write a complete evidence bundle (files changed, tests run, outputs)
- Touch list discipline (no changes outside the assigned scope)
- How to escalate a touch-list breach
- Gate commands: `pnpm -r typecheck && pnpm test:run && pnpm build`

### Priority Skill Creation Order

1. `qa-verification` — HIGH (no QA guidance exists)
2. `security-review` — HIGH (CSO has no domain-specific guidance)
3. `builder-engineering` — MEDIUM
4. `release-ops` — MEDIUM
5. Assign `para-memory-files` to CEO + PM — LOW

---

## 5) Tool Coverage (Worker Function Calling)

### Current 7 Tools

| Tool | Purpose | Quality |
|------|---------|---------|
| `paperclip_get_issue` | Fetch issue + ancestors | Good |
| `paperclip_get_comments` | Read comment thread | Good |
| `paperclip_update_issue` | Change status/assignee/add comment | Good, but see G1 bug |
| `paperclip_add_comment` | Post markdown comment | Good |
| `paperclip_create_issue` | Create subtask/delegate | Good |
| `paperclip_list_agents` | Discover agents for delegation | Good |
| `paperclip_list_issues` | Find work by status/assignee | Good |

### Missing Tools

**T1 — `paperclip_get_agent`** (MEDIUM)
Currently agents use `paperclip_list_agents` to find an agent and then parse the list.
A direct `paperclip_get_agent(agent_id)` would let the CEO confirm a specific agent's
current config, role, and model — useful before delegation decisions.

**T2 — `paperclip_release_issue`** (MEDIUM)
There is no explicit "release / unassign" tool. Agents currently do this via
`paperclip_update_issue(assigneeAgentId=null)` which is not obvious. A dedicated
`paperclip_release_issue` tool with a clear description reduces confusion.

**T3 — `paperclip_get_project`** (LOW)
Agents that decompose work at the project level have no way to read project metadata
(name, description, goals linked). Add `paperclip_get_project(project_id)`.

**T4 — `paperclip_get_goal`** (LOW)
CEO and CPO need to read goal context when making strategic decisions. Without this,
they only see issue-level context and risk losing sight of the strategic objective.

---

## 6) Model Assignments and Temperature

### Current Assignment

| Role | Model | Rationale |
|------|-------|-----------|
| CEO | MiniMax-M2.5 | Strong executive summarization |
| CTO | qwen3-coder-plus | Best technical decomposition |
| CPO | qwen3.5-plus | Balanced product/language quality |
| CSO | glm-5 | Risk-oriented defensive review |
| PM | qwen3.5-plus | Strong coordination quality |
| BuilderEngineer | qwen3-coder-plus | Best hands-on implementation |
| QAEngineer | glm-4.7 | Disciplined review and deterministic reporting |
| ReleaseOps | qwen3-coder-plus | Operational checklists and scripts |

### Issues

**M1 — glm-5 (CSO) tool-calling compatibility unverified** (HIGH RISK)
The Paperclip.md notes: "glm-5 and glm-4.7 DashScope availability should be verified per run."
If glm-5 does not support function calling on the DashScope Coding endpoint, CSO heartbeats
will silently fail at the tool-use loop. Recommend: run a smoke test with `ENABLE_TOOL_USE=false`
first, then re-enable. Consider switching CSO to `qwen3.5-plus` as a verified fallback.

**M2 — glm-4.7 (QAEngineer) same risk** (HIGH RISK)
Same concern for QA. If glm-4.7 cannot call tools, QA heartbeats will never update issue
status. Verified fallback: `qwen3.5-plus`.

**M3 — Temperature is uniform at 0.2** (MEDIUM)
Recommended per-role temperatures:
| Role | Recommended | Reasoning |
|------|-------------|-----------|
| CEO | 0.35 | Strategic synthesis needs breadth |
| CPO | 0.35 | Product framing benefits from variation |
| CSO | 0.15 | Risk classification must be conservative |
| CTO | 0.15 | Technical decomposition must be precise |
| PM | 0.20 | Good as-is |
| BuilderEngineer | 0.10 | Deterministic implementation |
| QAEngineer | 0.10 | No creative variation in verification |
| ReleaseOps | 0.10 | Checklists must be exact |

Set per-agent via `MODEL_TEMPERATURE` in `adapterConfig.env`.

---

## 7) Configuration Gaps (adapterConfig)

**C1 — `MAX_TOOL_TURNS` not set per role** (MEDIUM)
Default is 10 for all roles. But:
- CEO/CTO/PM may need 10 (complex delegation chains)
- Builder/QA/ReleaseOps only need 3–5 (read issue, post comment, update status)
Setting Builder to `MAX_TOOL_TURNS=5` prevents cost spikes from looping models.

**C2 — No heartbeat interval differentiation** (LOW)
All agents presumably run on the default Paperclip heartbeat interval. Strategic roles
(CEO, CTO, CPO, CSO) do not need to run as frequently as execution roles (Builder, PM, QA).
If the platform supports per-agent interval config, consider:
- CEO/CTO/CPO/CSO: every 4–6h (strategy does not change per-minute)
- PM/Builder/QA/ReleaseOps: every 1–2h (execution needs faster cycles)

**C3 — `AlibabaCodingCanary` agent is misconfigured** (MEDIUM)
This agent has no skills set and is role `engineer`. If it fires on production issues
it will produce low-quality output. Either:
1. Terminate it (it was a canary and is no longer needed), or
2. Fully configure it with skills and a proper system prompt.

---

## 8) Priority Action List

Ordered by impact vs. effort:

| # | Priority | Action | Effort |
|---|----------|--------|--------|
| 1 | HIGH | Add "Every section required, no omissions" to all 8 system prompts | 30 min |
| 2 | HIGH | Add "call paperclip_list_agents before assigning" to CEO/CTO/PM prompts | 15 min |
| 3 | HIGH | Fix `paperclip_update_issue` dict mutation bug (G1) in worker | 5 min |
| 4 | HIGH | Smoke test glm-5 and glm-4.7 tool-calling on DashScope (M1, M2) | 30 min |
| 5 | HIGH | Create `qa-verification` skill and assign to QAEngineer | 1h |
| 6 | HIGH | Create `security-review` skill and assign to CSO | 1h |
| 7 | MEDIUM | Fix Builder role framing to require explicit evidence list (R1) | 15 min |
| 8 | MEDIUM | Fix QA role framing to say where acceptance criteria live (R2) | 15 min |
| 9 | MEDIUM | Create `builder-engineering` skill and assign to BuilderEngineer | 45 min |
| 10 | MEDIUM | Create `release-ops` skill and assign to ReleaseOps | 45 min |
| 11 | MEDIUM | Set per-role `MODEL_TEMPERATURE` overrides (M3) | 20 min |
| 12 | MEDIUM | Set per-role `MAX_TOOL_TURNS` (C1) | 15 min |
| 13 | MEDIUM | Add HTTP retry logic to worker (G2) | 45 min |
| 14 | LOW | Assign `para-memory-files` to CEO and PM (S4) | 10 min |
| 15 | LOW | Terminate or fully configure AlibabaCodingCanary (C3) | 10 min |
| 16 | LOW | Add `paperclip_get_agent` and `paperclip_release_issue` tools (T1, T2) | 1h |

---

## 9) What Would Have the Highest Single Impact

If only one thing is done: **fix the system prompt output format enforcement** (#1 above).

The most common failure mode in role-based agent loops is that the model produces
helpful text but skips required structured sections under load. Making the format
non-negotiable in the system prompt (not just listed) closes the biggest
consistency gap with zero infrastructure change.

If only two things: add #1 and **create the `qa-verification` skill** (#5). QA is the
last gate before release. Without a skill, QA has no shared definition of "passing
evidence," which means every heartbeat is a coin flip on quality.
