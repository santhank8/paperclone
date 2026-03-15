# Plugin Authoring Guide

This guide describes the current, implemented way to create a Paperclip plugin in this repo.

It is intentionally narrower than [PLUGIN_SPEC.md](./PLUGIN_SPEC.md). The spec includes future ideas; this guide only covers the alpha surface that exists now.

For a complete API reference, see [PLUGIN_API_REFERENCE.md](./PLUGIN_API_REFERENCE.md).

## Current reality

- Treat plugin workers and plugin UI as trusted code.
- Plugin UI runs as same-origin JavaScript inside the main Paperclip app.
- Worker-side host APIs are capability-gated.
- Plugin UI is not sandboxed by manifest capabilities.
- There is no host-provided shared React component kit for plugins yet.
- `ctx.assets` is not supported in the current runtime.

## Quick start

A Paperclip plugin is an npm package with three parts:

1. **Manifest** - declares the plugin's identity, capabilities, UI slots, and entrypoints
2. **Worker** - server-side code that handles data, actions, events, and jobs
3. **UI** - React components rendered into the host app's extension points

Minimal example (dashboard widget that shows a counter):

**`src/manifest.ts`**

```typescript
const manifest = {
  id: "@yourscope/plugin-counter",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Counter Widget",
  description: "Shows a counter on the dashboard.",
  author: "you",
  categories: ["ui"],
  capabilities: ["ui.dashboardWidget.register"],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "counter-widget",
        displayName: "Counter",
        exportName: "CounterWidget",
      },
    ],
  },
};

export default manifest;
```

**`src/worker.ts`**

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

let count = 0;

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Counter plugin ready");

    ctx.data.register("count", async () => {
      return { count };
    });

    ctx.actions.register("increment", async () => {
      count += 1;
      return { count };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Counter plugin healthy" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

**`src/ui/index.tsx`**

```tsx
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui";
import type { PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";

export function CounterWidget({ context }: PluginWidgetProps) {
  const { data, loading } = usePluginData<{ count: number }>("count");
  const increment = usePluginAction("increment");
  const toast = usePluginToast();

  if (loading) return <div>Loading...</div>;

  async function handleClick() {
    try {
      await increment({});
      toast({ title: "Incremented", tone: "success" });
    } catch (err) {
      toast({ title: "Failed", body: String(err), tone: "error" });
    }
  }

  return (
    <div>
      <strong>Count: {data?.count ?? 0}</strong>
      <button onClick={handleClick}>+1</button>
    </div>
  );
}
```

**`package.json`** (key fields)

```json
{
  "name": "@yourscope/plugin-counter",
  "version": "0.1.0",
  "type": "module",
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js"
  }
}
```

The `paperclipPlugin` field is required. The host reads it to locate your manifest and worker entrypoints.

## Scaffold a plugin

Use the scaffold package:

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name --output ./packages/plugins/examples
```

For a plugin that lives outside the Paperclip repo:

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name \
  --output /absolute/path/to/plugin-repos \
  --sdk-path /absolute/path/to/paperclip/packages/plugins/sdk
```

Or using npx:

```bash
npx @paperclipai/create-paperclip-plugin @yourscope/plugin-name \
  --template connector \
  --category connector \
  --display-name "My Connector" \
  --description "Syncs data into Paperclip"
```

Supported templates: `default`, `connector`, `workspace`

That creates a package with:

- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `tests/plugin.spec.ts`
- `esbuild.config.mjs`
- `rollup.config.mjs`

Inside this monorepo, the scaffold uses `workspace:*` for `@paperclipai/plugin-sdk`.

Outside this monorepo, the scaffold snapshots `@paperclipai/plugin-sdk` from the local Paperclip checkout into a `.paperclip-sdk/` tarball so you can build and test a plugin without publishing anything to npm first.

## Recommended local workflow

From the generated plugin folder:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

For local development, install it into Paperclip from an absolute local path through the plugin manager or API. The server supports local filesystem installs and watches local-path plugins for file changes so worker restarts happen automatically after rebuilds.

Example:

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/absolute/path/to/your-plugin","isLocalPath":true}'
```

## Manifest reference

The manifest declares your plugin's identity and capabilities. Key fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique plugin identifier. Should match the npm package name. |
| `apiVersion` | yes | Always `1` for the current SDK. |
| `version` | yes | Semver version string. |
| `displayName` | yes | Human-readable name shown in the plugin manager. |
| `description` | yes | One-line description. |
| `author` | yes | Author name or organization. |
| `categories` | yes | Array of: `"ui"`, `"connector"`, `"automation"`, `"workspace"` |
| `capabilities` | yes | Array of capability strings (see below). |
| `entrypoints.worker` | yes | Path to the compiled worker JS file. |
| `entrypoints.ui` | no | Path to the compiled UI directory (if plugin has UI). |
| `ui.slots` | no | Array of UI slot declarations. |
| `ui.launchers` | no | Array of launcher declarations. |
| `instanceConfigSchema` | no | JSON Schema for operator-configurable settings. |
| `jobs` | no | Array of scheduled job declarations. |
| `webhooks` | no | Array of webhook endpoint declarations. |
| `tools` | no | Array of agent tool declarations. |

## Capabilities

Each `ctx.*` method requires a declared capability. The host rejects calls without it.

| Capability | Unlocks |
|-----------|---------|
| `companies.read` | `ctx.companies.list()`, `ctx.companies.get()` |
| `projects.read` | `ctx.projects.list()`, `ctx.projects.get()` |
| `project.workspaces.read` | `ctx.projects.listWorkspaces()` |
| `issues.read` | `ctx.issues.list()`, `ctx.issues.get()` |
| `issues.create` | `ctx.issues.create()` |
| `issues.update` | `ctx.issues.update()` |
| `issue.comments.read` | `ctx.issues.listComments()` |
| `issue.comments.create` | `ctx.issues.createComment()` |
| `agents.read` | `ctx.agents.list()`, `ctx.agents.get()` |
| `agents.pause` | `ctx.agents.pause()` |
| `agents.resume` | `ctx.agents.resume()` |
| `agents.invoke` | `ctx.agents.invoke()` |
| `agent.sessions.create` | `ctx.agents.sessions.create()` |
| `agent.sessions.list` | `ctx.agents.sessions.list()` |
| `agent.sessions.send` | `ctx.agents.sessions.sendMessage()` |
| `agent.sessions.close` | `ctx.agents.sessions.close()` |
| `goals.read` | `ctx.goals.list()`, `ctx.goals.get()` |
| `goals.create` | `ctx.goals.create()` |
| `goals.update` | `ctx.goals.update()` |
| `events.subscribe` | `ctx.events.on()` |
| `events.emit` | `ctx.events.emit()` |
| `jobs.schedule` | `ctx.jobs.register()` |
| `http.outbound` | `ctx.http.fetch()` |
| `secrets.read-ref` | `ctx.secrets.resolve()` |
| `plugin.state.read` | `ctx.state.get()` |
| `plugin.state.write` | `ctx.state.set()`, `ctx.state.delete()` |
| `activity.log.write` | `ctx.activity.log()` |
| `metrics.write` | `ctx.metrics.write()` |
| `agent.tools.register` | `ctx.tools.register()` |
| `webhooks.receive` | `onWebhook()` lifecycle method |
| `instance.settings.register` | Custom settings page via `settingsPage` slot |
| `ui.page.register` | `page` slot type |
| `ui.sidebar.register` | `sidebar`, `sidebarPanel` slot types |
| `ui.detailTab.register` | `detailTab` slot type |
| `ui.dashboardWidget.register` | `dashboardWidget` slot type |
| `ui.commentAnnotation.register` | `commentAnnotation`, `commentContextMenuItem` slot types |
| `ui.action.register` | `toolbarButton`, `contextMenuItem` slot types |

## Worker patterns

### Serving data to the UI

Register a data handler in `setup()`. The UI calls `usePluginData(key)` to fetch it.

```typescript
ctx.data.register("sync-health", async (params) => {
  const companyId = params.companyId as string;
  const state = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    stateKey: "last-sync",
  });
  return { lastSync: state, status: "healthy" };
});
```

### Handling UI actions

Register an action handler. The UI calls `usePluginAction(key)` to trigger it.

```typescript
ctx.actions.register("trigger-sync", async (params) => {
  const companyId = params.companyId as string;
  await ctx.http.fetch("https://api.example.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId }),
  });
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, stateKey: "last-sync" },
    new Date().toISOString()
  );
  return { ok: true };
});
```

### Subscribing to events

```typescript
ctx.events.on("issue.created", async (event) => {
  ctx.logger.info("New issue", { issueId: event.entityId });
  await ctx.http.fetch("https://hooks.slack.com/...", {
    method: "POST",
    body: JSON.stringify({ text: `New issue: ${event.payload.title}` }),
  });
});
```

Available events: `issue.created`, `issue.updated`, and plugin-namespaced events via `ctx.events.emit()`.

### Registering agent tools

Plugins can add tools that agents call during task execution.

```typescript
ctx.tools.register(
  "lookup-customer",
  {
    displayName: "Lookup Customer",
    description: "Looks up customer data by email.",
    parametersSchema: {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
  },
  async (params, runCtx) => {
    const result = await ctx.http.fetch(
      `https://api.example.com/customers?email=${params.email}`
    );
    const customer = await result.json();
    return { content: `Found: ${customer.name}`, data: customer };
  }
);
```

### Scheduled jobs

Declare the job in your manifest, then register a handler:

```typescript
// In manifest:
// jobs: [{ jobKey: "daily-sync", displayName: "Daily Sync", schedule: "0 9 * * *" }]

ctx.jobs.register("daily-sync", async (job) => {
  ctx.logger.info("Starting daily sync", { runId: job.runId, trigger: job.trigger });
  // ... sync logic
});
```

### Persistent state

State is scoped by kind and key. Use it for plugin-owned data that persists across restarts.

```typescript
// Write
await ctx.state.set(
  { scopeKind: "company", scopeId: companyId, stateKey: "cursor" },
  { page: 5, lastId: "abc123" }
);

// Read
const cursor = await ctx.state.get(
  { scopeKind: "company", scopeId: companyId, stateKey: "cursor" }
);

// Delete
await ctx.state.delete(
  { scopeKind: "company", scopeId: companyId, stateKey: "cursor" }
);
```

Scope kinds: `instance`, `company`, `project`, `project_workspace`, `agent`, `issue`, `goal`, `run`.

## UI patterns

### Hooks

All UI hooks are imported from `@paperclipai/plugin-sdk/ui`.

**`usePluginData<T>(key, params?)`** - Fetch data from the worker.

Returns `{ data: T | null, loading: boolean, error: PluginBridgeError | null, refresh: () => void }`.

```tsx
const { data, loading, error, refresh } = usePluginData<{ items: Item[] }>("items", {
  companyId: context.companyId,
});
```

**`usePluginAction(key)`** - Get a function that triggers a worker action.

Returns `(params?: Record<string, unknown>) => Promise<unknown>`. Throws `PluginBridgeError` on failure.

```tsx
const doSync = usePluginAction("trigger-sync");

async function handleSync() {
  await doSync({ companyId: context.companyId });
}
```

**`usePluginStream<T>(channel, options?)`** - Subscribe to real-time events from the worker.

Returns `{ events: T[], lastEvent: T | null, connecting: boolean, connected: boolean, error: Error | null, close: () => void }`.

```tsx
const { events, connected, close } = usePluginStream<{ step: number }>("progress");
```

**`usePluginToast()`** - Show host toast notifications.

Returns `(input: PluginToastInput) => string | null`.

```tsx
const toast = usePluginToast();
toast({ title: "Sync complete", tone: "success" });
toast({ title: "Error", body: "Connection refused", tone: "error", ttlMs: 5000 });
```

Tones: `"info"`, `"success"`, `"warn"`, `"error"`.

**`useHostContext()`** - Read the current host context.

Returns `{ companyId, companyPrefix, projectId, entityId, entityType, userId, renderEnvironment }`.

```tsx
const { companyId, projectId, entityId } = useHostContext();
```

### Slot prop types

Each slot type has a typed props interface:

| Slot type | Props interface |
|-----------|----------------|
| `page` | `PluginPageProps` |
| `dashboardWidget` | `PluginWidgetProps` |
| `detailTab` | `PluginDetailTabProps` (includes `entityId`, `entityType`) |
| `sidebar` | `PluginSidebarProps` |
| `sidebarPanel` | `PluginSidebarProps` |
| `projectSidebarItem` | `PluginProjectSidebarItemProps` (includes `entityId`, `entityType: "project"`) |
| `settingsPage` | `PluginSettingsPageProps` |
| `commentAnnotation` | `PluginCommentAnnotationProps` (includes `entityId`, `parentEntityId`) |
| `commentContextMenuItem` | `PluginCommentContextMenuItemProps` |
| `taskDetailView` | `PluginDetailTabProps` |
| `toolbarButton` | `PluginWidgetProps` |
| `contextMenuItem` | `PluginWidgetProps` |

All props include a `context` field with the host context for that slot.

## UI slot types

Mount surfaces currently wired in the host:

| Slot type | Where it renders | Typical use |
|-----------|-----------------|-------------|
| `page` | Full page at `/:company/<routePath>` | Plugin dashboard, settings, browsing |
| `settingsPage` | Plugin settings page (replaces auto-generated form) | Custom config UI |
| `dashboardWidget` | Card on the main dashboard | Status widgets, metrics |
| `sidebar` | Entry in the global sidebar | Navigation to plugin pages |
| `sidebarPanel` | Panel content in the sidebar | Quick-access plugin data |
| `projectSidebarItem` | Under each project in the sidebar | Per-project plugin links |
| `detailTab` | Tab on project/issue/agent detail pages | Entity-specific plugin views |
| `taskDetailView` | Task detail view for issues | Custom issue task view |
| `toolbarButton` | Toolbar action buttons | Quick actions |
| `contextMenuItem` | Right-click context menu | Entity actions |
| `commentAnnotation` | Below each comment in issue timeline | Per-comment metadata |
| `commentContextMenuItem` | Comment action menu | Per-comment actions |
| `globalToolbarButton` | Global toolbar | App-wide actions |

### Launchers

Launchers are triggerable actions placed in specific zones. They open modals, drawers, or navigate to plugin pages.

```typescript
// In manifest:
ui: {
  launchers: [
    {
      id: "my-launcher",
      displayName: "Open My Plugin",
      placementZone: "toolbarButton",
      entityTypes: ["project", "issue"],
      action: { type: "openModal", target: "MyModalComponent" },
      render: { environment: "hostOverlay", bounds: "wide" },
    },
  ],
}
```

Action types: `"navigate"`, `"openModal"`, `"openDrawer"`, `"openPopover"`, `"performAction"`, `"deepLink"`.

Placement zones: `"page"`, `"sidebar"`, `"sidebarPanel"`, `"settingsPage"`, `"dashboardWidget"`, `"detailTab"`, `"taskDetailView"`, `"projectSidebarItem"`, `"globalToolbarButton"`, `"toolbarButton"`, `"contextMenuItem"`, `"commentAnnotation"`, `"commentContextMenuItem"`.

## Company routes

Plugins may declare a `page` slot with `routePath` to own a company route like:

```text
/:companyPrefix/<routePath>
```

Rules:

- `routePath` must be a single lowercase slug
- it cannot collide with reserved host routes
- it cannot duplicate another installed plugin page route

## Testing

The SDK provides a test harness for unit testing plugins without running the full Paperclip server:

```typescript
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import plugin from "../src/worker.js";
import manifest from "../src/manifest.js";

const harness = createTestHarness({ manifest });

test("getData returns count", async () => {
  await plugin.definition.setup(harness.ctx);
  const result = await harness.getData("count", {});
  expect(result.count).toBe(0);
});

test("increment action works", async () => {
  await plugin.definition.setup(harness.ctx);
  await harness.performAction("increment", {});
  const result = await harness.getData("count", {});
  expect(result.count).toBe(1);
});
```

## Publishing guidance

- Use npm packages as the deployment artifact.
- The `paperclipPlugin` field in `package.json` is required for the host to discover your plugin.
- The `id` in your manifest should match the npm package name.
- Treat repo-local example installs as a development workflow only.
- Prefer keeping plugin UI self-contained inside the package.
- Do not rely on host design-system components or undocumented app internals.
- GitHub repository installs are not a first-class workflow today. For local development, use a checked-out local path. For production, publish to npm or a private npm-compatible registry.

## Verification before handoff

At minimum:

```bash
pnpm --filter <your-plugin-package> typecheck
pnpm --filter <your-plugin-package> test
pnpm --filter <your-plugin-package> build
```

If you changed host integration too, also run:

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```
