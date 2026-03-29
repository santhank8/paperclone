# 2026-03-14 技能 UI 产品计划

Status: Proposed
Date: 2026-03-14
Audience: 产品与工程
Related:
- `doc/plans/2026-03-13-company-import-export-v2.md`
- `doc/plans/2026-03-14-adapter-skill-sync-rollout.md`
- `docs/companies/companies-spec.md`
- `ui/src/pages/AgentDetail.tsx`

## 1. 目的

本文档定义了 Paperclip 中技能管理的产品与 UI 计划。

目标是让技能在网站上易于理解和管理，而不是假装所有适配器的行为都相同。

本计划的前提假设：

- `SKILL.md` 保持与 Agent Skills 兼容
- `skills.sh` 兼容性是 V1 的必要条件
- Paperclip 公司导入/导出可以将技能作为软件包内容包含在内
- 适配器可能支持持久技能同步、临时技能挂载、只读技能发现，或完全不集成技能

## 2. 现状

`AgentDetail` 上已经有一个初步的 Agent 级技能同步 UI。

目前支持：

- 加载适配器技能同步状态
- 清晰显示不受支持的适配器
- 以复选框形式显示已托管技能
- 单独显示外部技能
- 为实现新 API 的适配器同步期望技能

当前限制：

1. 没有公司级技能库 UI。
2. 网站上没有技能的软件包导入流程。
3. 技能软件包管理与按 Agent 技能附加之间没有区分。
4. 没有多 Agent 的期望状态与实际状态对比视图。
5. 当前 UI 以适配器同步为导向，而非以软件包为导向。
6. 不受支持的适配器会安全降级，但不够优雅。

## 2.1 V1 决策

对于 V1，本计划假设以下产品决策已经确定：

1. 必须支持 `skills.sh` 兼容性。
2. `AGENTS.md` 中 Agent 与技能的关联通过 shortname 或 slug 表示。
3. 公司技能与 Agent 技能附加是独立的概念。
4. Agent 技能应移至独立标签页，而不是嵌套在配置中。
5. 公司导入/导出最终应能完整往返传递技能软件包和 Agent 技能附加信息。

## 3. 产品原则

1. 技能首先是公司资产，其次才是 Agent 的附加项。
2. 软件包管理与适配器同步是不同的关注点，不应在同一个界面中混为一谈。
3. UI 必须始终如实展示 Paperclip 所知道的内容：
   - Paperclip 中的期望状态
   - 适配器上报的实际状态
   - 适配器是否能够协调两者之间的差异
4. Agent Skills 兼容性必须在产品模型中保持可见。
5. Agent 与技能的关联应尽可能以人类可读的 shortname 为基础。
6. 不受支持的适配器也应有可用的 UI，而不是仅仅显示死胡同。

## 4. User Model

Paperclip should treat skills at two scopes:

### 4.1 Company skills

These are reusable skills known to the company.

Examples:

- imported from a GitHub repo
- added from a local folder
- installed from a `skills.sh`-compatible repo
- created locally inside Paperclip later

These should have:

- name
- description
- slug or package identity
- source/provenance
- trust level
- compatibility status

### 4.2 Agent skills

These are skill attachments for a specific agent.

Each attachment should have:

- shortname
- desired state in Paperclip
- actual state in the adapter when readable
- sync status
- origin

Agent attachments should normally reference skills by shortname or slug, for example:

- `review`
- `react-best-practices`

not by noisy relative file path.

## 4.3 Primary user jobs

The UI should support these jobs cleanly:

1. “Show me what skills this company has.”
2. “Import a skill from GitHub or a local folder.”
3. “See whether a skill is safe, compatible, and who uses it.”
4. “Attach skills to an agent.”
5. “See whether the adapter actually has those skills.”
6. “Reconcile desired vs actual skill state.”
7. “Understand what Paperclip knows vs what the adapter knows.”

## 5. Core UI Surfaces

The product should have two primary skill surfaces.

### 5.1 Company Skills page

Add a company-level page, likely:

- `/companies/:companyId/skills`

Purpose:

- manage the company skill library
- import and inspect skill packages
- understand provenance and trust
- see which agents use which skills

#### Route

- `/companies/:companyId/skills`

#### Primary actions

- import skill
- inspect skill
- attach to agents
- detach from agents
- export selected skills later

#### Empty state

When the company has no managed skills:

- explain what skills are
- explain `skills.sh` / Agent Skills compatibility
- offer `Import from GitHub` and `Import from folder`
- optionally show adapter-discovered skills as a secondary “not managed yet” section

#### A. Skill library list

Each skill row should show:

- name
- short description
- source badge
- trust badge
- compatibility badge
- number of attached agents

Suggested source states:

- local
- github
- imported package
- external reference
- adapter-discovered only

Suggested compatibility states:

- compatible
- paperclip-extension
- unknown
- invalid

Suggested trust states:

- markdown-only
- assets
- scripts/executables

Suggested list affordances:

- search by name or slug
- filter by source
- filter by trust level
- filter by usage
- sort by name, recent import, usage count

#### B. Import actions

Allow:

- import from local folder
- import from GitHub URL
- import from direct URL

Future:

- install from `companies.sh`
- install from `skills.sh`

V1 requirement:

- importing from a `skills.sh`-compatible source should work without requiring a Paperclip-specific package layout

#### C. Skill detail drawer or page

Each skill should have a detail view showing:

- rendered `SKILL.md`
- package source and pinning
- included files
- trust and licensing warnings
- who uses it
- adapter compatibility notes

Recommended route:

- `/companies/:companyId/skills/:skillId`

Recommended sections:

- Overview
- Contents
- Usage
- Source
- Trust / licensing

#### D. Usage view

Each company skill should show which agents use it.

Suggested columns:

- agent
- desired state
- actual state
- adapter
- sync mode
- last sync status

### 5.2 Agent Skills tab

Keep and evolve the existing `AgentDetail` skill sync UI, but move it out of configuration.

Purpose:

- attach/detach company skills to one agent
- inspect adapter reality for that agent
- reconcile desired vs actual state
- keep the association format readable and aligned with `AGENTS.md`

#### Route

- `/agents/:agentId/skills`

#### Agent tabs

The intended agent-level tab model becomes:

- `dashboard`
- `configuration`
- `skills`
- `runs`

This is preferable to hiding skills inside configuration because:

- skills are not just adapter config
- skills need their own sync/status language
- skills are a reusable company asset, not merely one agent field
- the screen needs room for desired vs actual state, warnings, and external skill adoption

#### Tab layout

The `Skills` tab should have three stacked sections:

1. Summary
2. Managed skills
3. External / discovered skills

Summary should show:

- adapter sync support
- sync mode
- number of managed skills
- number of external skills
- drift or warning count

#### A. Desired skills

Show company-managed skills attached to the agent.

Each row should show:

- skill name
- shortname
- sync state
- source
- last adapter observation if available

Each row should support:

- enable / disable
- open skill detail
- see source badge
- see sync badge

#### B. External or discovered skills

Show skills reported by the adapter that are not company-managed.

This matters because Codex and similar adapters may already have local skills that Paperclip did not install.

These should be clearly marked:

- external
- not managed by Paperclip

Each external row should support:

- inspect
- adopt into company library later
- attach as managed skill later if appropriate

#### C. Sync controls

Support:

- sync
- reset draft
- detach

Future:

- import external skill into company library
- promote ad hoc local skill into a managed company skill

Recommended footer actions:

- `Sync skills`
- `Reset`
- `Refresh adapter state`

## 6. Skill State Model In The UI

Each skill attachment should have a user-facing state.

Suggested states:

- `in_sync`
- `desired_only`
- `external`
- `drifted`
- `unmanaged`
- `unknown`

Definitions:

- `in_sync`: desired and actual match
- `desired_only`: Paperclip wants it, adapter does not show it yet
- `external`: adapter has it but Paperclip does not manage it
- `drifted`: adapter has a conflicting or unexpected version/location
- `unmanaged`: adapter does not support sync, Paperclip only tracks desired state
- `unknown`: adapter read failed or state cannot be trusted

Suggested badge copy:

- `In sync`
- `Needs sync`
- `External`
- `Drifted`
- `Unmanaged`
- `Unknown`

## 7. Adapter Presentation Rules

The UI should not describe all adapters the same way.

### 7.1 Persistent adapters

Example:

- Codex local

Language:

- installed
- synced into adapter home
- external skills detected

### 7.2 Ephemeral adapters

Example:

- Claude local

Language:

- will be mounted on next run
- effective runtime skills
- not globally installed

### 7.3 Unsupported adapters

Language:

- this adapter does not implement skill sync yet
- Paperclip can still track desired skills
- actual adapter state is unavailable

This state should still allow:

- attaching company skills to the agent as desired state
- export/import of those desired attachments

## 7.4 Read-only adapters

Some adapters may be able to list skills but not mutate them.

Language:

- Paperclip can see adapter skills
- this adapter does not support applying changes
- desired state can be tracked, but reconciliation is manual

## 8. Information Architecture

Recommended navigation:

- company nav adds `Skills`
- agent detail adds `Skills` as its own tab
- company skill detail gets its own route when the company library ships

Recommended separation:

- Company Skills page answers: “What skills do we have?”
- Agent Skills tab answers: “What does this agent use, and is it synced?”

## 8.1 Proposed route map

- `/companies/:companyId/skills`
- `/companies/:companyId/skills/:skillId`
- `/agents/:agentId/skills`

## 8.2 Nav and discovery

Recommended entry points:

- company sidebar: `Skills`
- agent page tabs: `Skills`
- company import preview: link imported skills to company skills page later
- agent skills rows: link to company skill detail

## 9. Import / Export Integration

Skill UI and package portability should meet in the company skill library.

Import behavior:

- importing a company package with `SKILL.md` content should create or update company skills
- agent attachments should primarily come from `AGENTS.md` shortname associations
- `.paperclip.yaml` may add Paperclip-specific fidelity, but should not replace the base shortname association model
- referenced third-party skills should keep provenance visible

Export behavior:

- exporting a company should include company-managed skills when selected
- `AGENTS.md` should emit skill associations by shortname or slug
- `.paperclip.yaml` may add Paperclip-specific skill fidelity later if needed, but should not be required for ordinary agent-to-skill association
- adapter-only external skills should not be silently exported as managed company skills

## 9.1 Import workflows

V1 workflows should support:

1. import one or more skills from a local folder
2. import one or more skills from a GitHub repo
3. import a company package that contains skills
4. attach imported skills to one or more agents

Import preview for skills should show:

- skills discovered
- source and pinning
- trust level
- licensing warnings
- whether an existing company skill will be created, updated, or skipped

## 9.2 Export workflows

V1 should support:

1. export a company with managed skills included when selected
2. export an agent whose `AGENTS.md` contains shortname skill associations
3. preserve Agent Skills compatibility for each `SKILL.md`

Out of scope for V1:

- exporting adapter-only external skills as managed packages automatically

## 10. Data And API Shape

This plan implies a clean split in backend concepts.

### 10.1 Company skill records

Paperclip should have a company-scoped skill model or managed package model representing:

- identity
- source
- files
- provenance
- trust and licensing metadata

### 10.2 Agent skill attachments

Paperclip should separately store:

- agent id
- skill identity
- desired enabled state
- optional ordering or metadata later

### 10.3 Adapter sync snapshot

Adapter reads should return:

- supported flag
- sync mode
- entries
- warnings
- desired skills

This already exists in rough form and should be the basis for the UI.

### 10.4 UI-facing API needs

The complete UI implies these API surfaces:

- list company-managed skills
- import company skills from path/URL/GitHub
- get one company skill detail
- list agents using a given skill
- attach/detach company skills for an agent
- list adapter sync snapshot for an agent
- apply desired skills for an agent

Existing agent-level skill sync APIs can remain the base for the agent tab.
The company-level library APIs still need to be designed and implemented.

## 11. Page-by-page UX

### 11.1 Company Skills list page

Header:

- title
- short explanation of compatibility with Agent Skills / `skills.sh`
- import button

Body:

- filters
- skill table or cards
- empty state when none

Secondary content:

- warnings panel for untrusted or incompatible skills

### 11.2 Company Skill detail page

Header:

- skill name
- shortname
- source badge
- trust badge
- compatibility badge

Sections:

- rendered `SKILL.md`
- files and references
- usage by agents
- source / provenance
- trust and licensing warnings

Actions:

- attach to agent
- remove from company library later
- export later

### 11.3 Agent Skills tab

Header:

- adapter support summary
- sync mode
- refresh and sync actions

Body:

- managed skills list
- external/discovered skills list
- warnings / unsupported state block

## 12. States And Empty Cases

### 12.1 Company Skills page

States:

- empty
- loading
- loaded
- import in progress
- import failed

### 12.2 Company Skill detail

States:

- loading
- not found
- incompatible
- loaded

### 12.3 Agent Skills tab

States:

- loading snapshot
- unsupported adapter
- read-only adapter
- sync-capable adapter
- sync failed
- stale draft

## 13. Permissions And Governance

Suggested V1 policy:

- board users can manage company skills
- board users can attach skills to agents
- agents themselves do not mutate company skill library by default
- later, certain agents may get scoped permissions for skill attachment or sync

## 14. UI Phases

### Phase A: Stabilize current agent skill sync UI

Goals:

- move skills to an `AgentDetail` tab
- improve status language
- support desired-only state even on unsupported adapters
- polish copy for persistent vs ephemeral adapters

### Phase B: Add Company Skills page

Goals:

- company-level skill library
- import from GitHub/local folder
- basic detail view
- usage counts by agent
- `skills.sh`-compatible import path

### Phase C: Connect skills to portability

Goals:

- importing company packages creates company skills
- exporting selected skills works cleanly
- agent attachments round-trip primarily through `AGENTS.md` shortnames

### Phase D: External skill adoption flow

Goals:

- detect adapter external skills
- allow importing them into company-managed state where possible
- make provenance explicit

### Phase E: Advanced sync and drift UX

Goals:

- desired-vs-actual diffing
- drift resolution actions
- multi-agent skill usage and sync reporting

## 15. Design Risks

1. Overloading the agent page with package management will make the feature confusing.
2. Treating unsupported adapters as broken rather than unmanaged will make the product feel inconsistent.
3. Mixing external adapter-discovered skills with company-managed skills without clear labels will erode trust.
4. If company skill records do not exist, import/export and UI will remain loosely coupled and round-trip fidelity will stay weak.
5. If agent skill associations are path-based instead of shortname-based, the format will feel too technical and too Paperclip-specific.

## 16. Recommendation

The next product step should be:

1. move skills out of agent configuration and into a dedicated `Skills` tab
2. add a dedicated company-level `Skills` page as the library and package-management surface
3. make company import/export target that company skill library, not the agent page directly
4. preserve adapter-aware truth in the UI by clearly separating:
   - desired
   - actual
   - external
   - unmanaged
5. keep agent-to-skill associations shortname-based in `AGENTS.md`

That gives Paperclip one coherent skill story instead of forcing package management, adapter sync, and agent configuration into the same screen.
