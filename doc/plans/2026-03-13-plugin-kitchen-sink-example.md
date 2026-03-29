# Kitchen Sink 插件计划

## 目标

新增一个官方示例插件 `Kitchen Sink (Example)`，在一个地方集中演示当前已实现的所有 Paperclip 插件 API 表面。

该插件的定位是：

- 为贡献者提供持续维护的参考实现
- 作为插件运行时的手动测试工具
- 直观地展示插件目前能做到的所有功能

它并非面向最终用户的成熟产品插件。

## 背景

当前插件系统已有真实的 API 表面，但这些内容分散在：

- SDK 文档
- SDK 类型定义
- 插件规范文档
- 两个示例插件（各自只展示了一小部分功能）

这使得以下基本问题难以得到解答：

- 插件能渲染什么？
- 插件 worker 实际上能做什么？
- 哪些表面是真实可用的，哪些仅是规划中的？
- 新插件在本仓库中应如何组织结构？

kitchen-sink 插件应通过实例来回答这些问题。

## 成功标准

如果贡献者无需事先阅读 SDK，就能在 Paperclip 内安装插件并探索、体验当前插件运行时的完整功能范围，则视为成功。

具体而言：

- 可从内置示例列表安装
- 针对每个已实现的 worker API 表面至少提供一个演示
- 针对每个宿主挂载的 UI 表面至少提供一个演示
- 清晰标注仅限本地 / 仅限受信任环境的演示
- 默认情况下对本地开发足够安全
- 同时兼作插件运行时变更的回归测试工具

## 约束条件

- 保持实例级安装，而非公司级安装。
- 将其视为受信任的本地示例插件。
- 不依赖云安全运行时假设。
- 避免破坏性的默认行为。
- 避免不可逆的数据变更，除非已清晰标注且易于撤销。

## 本计划的依据来源

本计划基于当前已实现的 SDK/类型/运行时，而非仅参考长期规划文档。

主要参考文件：

- `packages/plugins/sdk/README.md`
- `packages/plugins/sdk/src/types.ts`
- `packages/plugins/sdk/src/ui/types.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/types/plugin.ts`

## 当前表面功能清单

### 需要演示的 Worker/运行时 API

以下是 SDK 当前暴露的具体 `ctx` 客户端：

- `ctx.config`
- `ctx.events`
- `ctx.jobs`
- `ctx.launchers`
- `ctx.http`
- `ctx.secrets`
- `ctx.assets`
- `ctx.activity`
- `ctx.state`
- `ctx.entities`
- `ctx.projects`
- `ctx.companies`
- `ctx.issues`
- `ctx.agents`
- `ctx.goals`
- `ctx.data`
- `ctx.actions`
- `ctx.streams`
- `ctx.tools`
- `ctx.metrics`
- `ctx.logger`

### 需要演示的 UI 表面

SDK 中定义的表面：

- `page`
- `settingsPage`
- `dashboardWidget`
- `sidebar`
- `sidebarPanel`
- `detailTab`
- `taskDetailView`
- `projectSidebarItem`
- `toolbarButton`
- `contextMenuItem`
- `commentAnnotation`
- `commentContextMenuItem`

### Current host confidence

Confirmed or strongly indicated as mounted in the current app:

- `page`
- `settingsPage`
- `dashboardWidget`
- `detailTab`
- `projectSidebarItem`
- comment surfaces
- launcher infrastructure

Need explicit validation before claiming full demo coverage:

- `sidebar`
- `sidebarPanel`
- `taskDetailView`
- `toolbarButton` as direct slot, distinct from launcher placement
- `contextMenuItem` as direct slot, distinct from comment menu and launcher placement

The implementation should keep a small validation checklist for these before we call the plugin "complete".

## Plugin Concept

The plugin should be named:

- display name: `Kitchen Sink (Example)`
- package: `@paperclipai/plugin-kitchen-sink-example`
- plugin id: `paperclip.kitchen-sink-example` or `paperclip-kitchen-sink-example`

Recommendation: use `paperclip-kitchen-sink-example` to match current in-repo example naming style.

Category mix:

- `ui`
- `automation`
- `workspace`
- `connector`

That is intentionally broad because the point is coverage.

## UX Shape

The plugin should have one main full-page demo console plus smaller satellites on other surfaces.

### 1. Plugin page

Primary route: the plugin `page` surface should be the central dashboard for all demos.

Recommended page sections:

- `Overview`
  - what this plugin demonstrates
  - current capabilities granted
  - current host context
- `UI Surfaces`
  - links explaining where each other surface should appear
- `Data + Actions`
  - buttons and forms for bridge-driven worker demos
- `Events + Streams`
  - emit event
  - watch event log
  - stream demo output
- `Paperclip Domain APIs`
  - companies
  - projects/workspaces
  - issues
  - goals
  - agents
- `Local Workspace + Process`
  - file listing
  - file read/write scratch area
  - child process demo
- `Jobs + Webhooks + Tools`
  - job status
  - webhook URL and recent deliveries
  - declared tools
- `State + Entities + Assets`
  - scoped state editor
  - plugin entity inspector
  - upload/generated asset demo
- `Observability`
  - metrics written
  - activity log samples
  - latest worker logs

### 2. Dashboard widget

A compact widget on the main dashboard should show:

- plugin health
- count of demos exercised
- recent event/stream activity
- shortcut to the full plugin page

### 3. Project sidebar item

Add a `Kitchen Sink` link under each project that deep-links into a project-scoped plugin tab.

### 4. Detail tabs

Use detail tabs to demonstrate entity-context rendering on:

- `project`
- `issue`
- `agent`
- `goal`

Each tab should show:

- the host context it received
- the relevant entity fetch via worker bridge
- one small action scoped to that entity

### 5. Comment surfaces

Use issue comment demos to prove comment-specific extension points:

- `commentAnnotation`
  - render parsed metadata below each comment
  - show comment id, issue id, and a small derived status
- `commentContextMenuItem`
  - add a menu action like `Copy Context To Kitchen Sink`
  - action writes a plugin entity or state record for later inspection

### 6. Settings page

Custom `settingsPage` should be intentionally simple and operational:

- `About`
- `Danger / Trust Model`
- demo toggles
- local process defaults
- workspace scratch-path behavior
- secret reference inputs
- event/job/webhook sample config

This plugin should also keep the generic plugin settings `Status` tab useful by writing health, logs, and metrics.

## Feature Matrix

Each implemented worker API should have a visible demo.

### `ctx.config`

Demo:

- read live config
- show config JSON
- react to config changes without restart where possible

### `ctx.events`

Demos:

- emit a plugin event
- subscribe to plugin events
- subscribe to a core Paperclip event such as `issue.created`
- show recent received events in a timeline

### `ctx.jobs`

Demos:

- one scheduled heartbeat-style demo job
- one manual run button from the UI if host supports manual job trigger
- show last run result and timestamps

### `ctx.launchers`

Demos:

- declare launchers in manifest
- optionally register one runtime launcher from the worker
- show launcher metadata on the plugin page

### `ctx.http`

Demo:

- make a simple outbound GET request to a safe endpoint
- show status code, latency, and JSON result

Recommendation: default to a Paperclip-local endpoint or a stable public echo endpoint to avoid flaky docs.

### `ctx.secrets`

Demo:

- operator enters a secret reference in config
- plugin resolves it on demand
- UI only shows masked result length / success status, never raw secret

### `ctx.assets`

Demos:

- generate a text asset from the UI
- optionally upload a tiny JSON blob or screenshot-like text file
- show returned asset URL

### `ctx.activity`

Demo:

- button to write a plugin activity log entry against current company/entity

### `ctx.state`

Demos:

- instance-scoped state
- company-scoped state
- project-scoped state
- issue-scoped state
- delete/reset controls

Use a small state inspector/editor on the plugin page.

### `ctx.entities`

Demos:

- create plugin-owned sample records
- list/filter them
- show one realistic use case such as "copied comments" or "demo sync records"

### `ctx.projects`

Demos:

- list projects
- list project workspaces
- resolve primary workspace
- resolve workspace for issue

### `ctx.companies`

Demo:

- list companies and show current selected company

### `ctx.issues`

Demos:

- list issues in current company
- create issue
- update issue status/title
- list comments
- create comment

### `ctx.agents`

Demos:

- list agents
- invoke one agent with a test prompt
- pause/resume where safe

Agent mutation controls should be behind an explicit warning.

### `ctx.agents.sessions`

Demos:

- create agent chat session
- send message
- stream events back to the UI
- close session

This is a strong candidate for the best "wow" demo on the plugin page.

### `ctx.goals`

Demos:

- list goals
- create goal
- update status/title

### `ctx.data`

Use throughout the plugin for all read-side bridge demos.

### `ctx.actions`

Use throughout the plugin for all mutation-side bridge demos.

### `ctx.streams`

Demos:

- live event log stream
- token-style stream from an agent session relay
- fake progress stream for a long-running action

### `ctx.tools`

Demos:

- declare 2-3 simple agent tools
- tool 1: echo/diagnostics
- tool 2: project/workspace summary
- tool 3: create issue or write plugin state

The plugin page should list declared tools and show example input payloads.

### `ctx.metrics`

Demo:

- write a sample metric on each major demo action
- surface a small recent metrics table in the plugin page

### `ctx.logger`

Demo:

- every action logs structured entries
- plugin settings `Status` page then doubles as the log viewer

## Local Workspace And Process Demos

The plugin SDK intentionally leaves file/process operations to the plugin itself once it has workspace metadata.

The kitchen-sink plugin should demonstrate that explicitly.

### Workspace demos

- list files from a selected workspace
- read a file
- write to a plugin-owned scratch file
- optionally search files with `rg` if available

### Process demos

- run a short-lived command like `pwd`, `ls`, or `git status`
- stream stdout/stderr back to UI
- show exit code and timing

Important safeguards:

- default commands must be read-only
- no shell interpolation from arbitrary free-form input in v1
- provide a curated command list or a strongly validated command form
- clearly label this area as local-only and trusted-only

## Proposed Manifest Coverage

The plugin should aim to declare:

- `page`
- `settingsPage`
- `dashboardWidget`
- `detailTab` for `project`, `issue`, `agent`, `goal`
- `projectSidebarItem`
- `commentAnnotation`
- `commentContextMenuItem`

Then, after host validation, add if supported:

- `sidebar`
- `sidebarPanel`
- `taskDetailView`
- `toolbarButton`
- `contextMenuItem`

It should also declare one or more `ui.launchers` entries to exercise launcher behavior independently of slot rendering.

## Proposed Package Layout

New package:

- `packages/plugins/examples/plugin-kitchen-sink-example/`

Expected files:

- `package.json`
- `README.md`
- `tsconfig.json`
- `src/index.ts`
- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `src/ui/components/...`
- `src/ui/hooks/...`
- `src/lib/...`
- optional `scripts/build-ui.mjs` if UI bundling needs esbuild

## Proposed Internal Architecture

### Worker modules

Recommended split:

- `src/worker.ts`
  - plugin definition and wiring
- `src/worker/data.ts`
  - `ctx.data.register(...)`
- `src/worker/actions.ts`
  - `ctx.actions.register(...)`
- `src/worker/events.ts`
  - event subscriptions and event log buffer
- `src/worker/jobs.ts`
  - scheduled job handlers
- `src/worker/tools.ts`
  - tool declarations and handlers
- `src/worker/local-runtime.ts`
  - file/process demos
- `src/worker/demo-store.ts`
  - helpers for state/entities/assets/metrics

### UI modules

Recommended split:

- `src/ui/index.tsx`
  - exported slot components
- `src/ui/page/KitchenSinkPage.tsx`
- `src/ui/settings/KitchenSinkSettingsPage.tsx`
- `src/ui/widgets/KitchenSinkDashboardWidget.tsx`
- `src/ui/tabs/ProjectKitchenSinkTab.tsx`
- `src/ui/tabs/IssueKitchenSinkTab.tsx`
- `src/ui/tabs/AgentKitchenSinkTab.tsx`
- `src/ui/tabs/GoalKitchenSinkTab.tsx`
- `src/ui/comments/KitchenSinkCommentAnnotation.tsx`
- `src/ui/comments/KitchenSinkCommentMenuItem.tsx`
- `src/ui/shared/...`

## Configuration Schema

The plugin should have a substantial but understandable `instanceConfigSchema`.

Recommended config fields:

- `enableDangerousDemos`
- `enableWorkspaceDemos`
- `enableProcessDemos`
- `showSidebarEntry`
- `showSidebarPanel`
- `showProjectSidebarItem`
- `showCommentAnnotation`
- `showCommentContextMenuItem`
- `showToolbarLauncher`
- `defaultDemoCompanyId` optional
- `secretRefExample`
- `httpDemoUrl`
- `processAllowedCommands`
- `workspaceScratchSubdir`

Defaults should keep risky behavior off.

## Safety Defaults

Default posture:

- UI and read-only demos on
- mutating domain demos on but explicitly labeled
- process demos off by default
- no arbitrary shell input by default
- no raw secret rendering ever

## Phased Build Plan

### Phase 1: Core plugin skeleton

- scaffold package
- add manifest, worker, UI entrypoints
- add README
- make it appear in bundled examples list

### Phase 2: Core, confirmed UI surfaces

- plugin page
- settings page
- dashboard widget
- project sidebar item
- detail tabs

### Phase 3: Core worker APIs

- config
- state
- entities
- companies/projects/issues/goals
- data/actions
- metrics/logger/activity

### Phase 4: Real-time and automation APIs

- streams
- events
- jobs
- webhooks
- agent sessions
- tools

### Phase 5: Local trusted runtime demos

- workspace file demos
- child process demos
- guarded by config

### Phase 6: Secondary UI surfaces

- comment annotation
- comment context menu item
- launchers

### Phase 7: Validation-only surfaces

Validate whether the current host truly mounts:

- `sidebar`
- `sidebarPanel`
- `taskDetailView`
- direct-slot `toolbarButton`
- direct-slot `contextMenuItem`

If mounted, add demos.
If not mounted, document them as SDK-defined but host-pending.

## Documentation Deliverables

The plugin should ship with a README that includes:

- what it demonstrates
- which surfaces are local-only
- how to install it
- where each UI surface should appear
- a mapping from demo card to SDK API

It should also be referenced from plugin docs as the "reference everything plugin".

## Testing And Verification

Minimum verification:

- package typecheck/build
- install from bundled example list
- page loads
- widget appears
- project tab appears
- comment surfaces render
- settings page loads
- key actions succeed

Recommended manual checklist:

- create issue from plugin
- create goal from plugin
- emit and receive plugin event
- stream action output
- open agent session and receive streamed reply
- upload an asset
- write plugin activity log
- run a safe local process demo

## Open Questions

1. Should the process demo remain curated-command-only in the first pass?
   Recommendation: yes.

2. Should the plugin create throwaway "kitchen sink demo" issues/goals automatically?
   Recommendation: no. Make creation explicit.

3. Should we expose unsupported-but-typed surfaces in the UI even if host mounting is not wired?
   Recommendation: yes, but label them as `SDK-defined / host validation pending`.

4. Should agent mutation demos include pause/resume by default?
   Recommendation: probably yes, but behind a warning block.

5. Should this plugin be treated as a supported regression harness in CI later?
   Recommendation: yes. Long term, this should be the plugin-runtime smoke test package.

## Recommended Next Step

If this plan looks right, the next implementation pass should start by building only:

- package skeleton
- page
- settings page
- dashboard widget
- one project detail tab
- one issue detail tab
- the basic worker/action/data/state/event scaffolding

That is enough to lock the architecture before filling in every demo surface.
