# Plugin API Reference

Complete reference for the Paperclip plugin SDK. This covers every `ctx.*` method available in the worker and every hook available in the UI.

For a practical guide with examples, see [PLUGIN_AUTHORING_GUIDE.md](./PLUGIN_AUTHORING_GUIDE.md).

## Worker SDK

Import from `@paperclipai/plugin-sdk`.

### `definePlugin(definition)`

Creates a plugin instance. The definition object supports these lifecycle methods:

| Method | Called when |
|--------|-----------|
| `setup(ctx)` | Host starts the plugin worker. Register handlers here. |
| `onHealth()` | Host health probe. Return `{ status, message, details }`. |
| `onConfigChanged(config)` | Operator updates plugin configuration. |
| `onValidateConfig(config)` | Host asks plugin to validate proposed config. Return `{ ok, errors, warnings }`. |
| `onWebhook(input)` | External webhook delivery arrives. Requires `webhooks.receive`. |
| `onShutdown()` | Host is stopping the plugin worker. |

### `runWorker(plugin, importMetaUrl)`

Starts the worker RPC host. Call this at the end of your worker file:

```typescript
export default plugin;
runWorker(plugin, import.meta.url);
```

## Worker context (`ctx`)

The `ctx` object passed to `setup()` provides all host APIs. Each method requires a declared capability in the manifest.

### `ctx.config`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `get()` | `() => Promise<Record<string, unknown>>` | none (always available) |

### `ctx.data`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `register(key, handler)` | `(key: string, handler: (params: Record<string, unknown>) => Promise<unknown>) => void` | none |

Register a data handler that UI components fetch via `usePluginData(key)`.

### `ctx.actions`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `register(key, handler)` | `(key: string, handler: (params: Record<string, unknown>) => Promise<unknown>) => void` | none |

Register an action handler that UI components trigger via `usePluginAction(key)`.

### `ctx.events`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `on(eventType, handler)` | `(eventType: string, handler: (event: PluginEvent) => Promise<void>) => void` | `events.subscribe` |
| `emit(name, companyId, payload)` | `(name: string, companyId: string, payload: unknown) => Promise<void>` | `events.emit` |

Event types: `issue.created`, `issue.updated`, and plugin-namespaced events (`plugin.<pluginId>.<name>`).

### `ctx.jobs`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `register(jobKey, handler)` | `(jobKey: string, handler: (job: PluginJobContext) => Promise<void>) => void` | `jobs.schedule` |

The job must be declared in the manifest's `jobs` array with a cron schedule.

### `ctx.launchers`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `register(launcher)` | `(launcher: PluginLauncherRegistration) => void` | none |

Register a launcher at runtime (in addition to manifest-declared launchers).

### `ctx.http`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `fetch(url, init?)` | `(url: string, init?: RequestInit) => Promise<Response>` | `http.outbound` |

Standard fetch API. The host logs requests for audit purposes.

### `ctx.secrets`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `resolve(secretRef)` | `(secretRef: string) => Promise<string>` | `secrets.read-ref` |

Resolves a secret reference (from plugin config) to its actual value.

### `ctx.activity`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `log(entry)` | `(entry: PluginActivityLogEntry) => Promise<void>` | `activity.log.write` |

Entry fields: `companyId`, `entityType?`, `entityId?`, `message`, `metadata?`.

### `ctx.state`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `get(scopeKey)` | `(scopeKey: ScopeKey) => Promise<unknown>` | `plugin.state.read` |
| `set(scopeKey, value)` | `(scopeKey: ScopeKey, value: unknown) => Promise<void>` | `plugin.state.write` |
| `delete(scopeKey)` | `(scopeKey: ScopeKey) => Promise<void>` | `plugin.state.write` |

ScopeKey: `{ scopeKind, scopeId?, namespace?, stateKey }`.
Scope kinds: `instance`, `company`, `project`, `project_workspace`, `agent`, `issue`, `goal`, `run`.

### `ctx.entities`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `upsert(entity)` | `(entity: PluginEntityUpsert) => Promise<PluginEntityRecord>` | none |
| `list(query)` | `(query: PluginEntityQuery) => Promise<PluginEntityRecord[]>` | none |

Plugin-owned entity records for tracking external mappings.

### `ctx.companies`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `list(params)` | `(params: { limit, offset }) => Promise<Company[]>` | `companies.read` |
| `get(companyId)` | `(companyId: string) => Promise<Company>` | `companies.read` |

### `ctx.projects`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `list(params)` | `(params: { companyId, limit, offset }) => Promise<Project[]>` | `projects.read` |
| `get(projectId, companyId)` | `(projectId: string, companyId: string) => Promise<Project>` | `projects.read` |
| `listWorkspaces(projectId, companyId)` | `(projectId: string, companyId: string) => Promise<PluginWorkspace[]>` | `project.workspaces.read` |

### `ctx.issues`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `list(params)` | `(params: { companyId, limit, offset }) => Promise<Issue[]>` | `issues.read` |
| `get(issueId, companyId)` | `(issueId: string, companyId: string) => Promise<Issue>` | `issues.read` |
| `create(params)` | `(params: { companyId, projectId?, title, description? }) => Promise<Issue>` | `issues.create` |
| `update(issueId, params, companyId)` | `(issueId: string, params: { status? }, companyId: string) => Promise<Issue>` | `issues.update` |
| `listComments(issueId, companyId)` | `(issueId: string, companyId: string) => Promise<IssueComment[]>` | `issue.comments.read` |
| `createComment(issueId, companyId, params)` | `(issueId: string, companyId: string, params: { body }) => Promise<IssueComment>` | `issue.comments.create` |

### `ctx.agents`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `list(params)` | `(params: { companyId, limit, offset }) => Promise<Agent[]>` | `agents.read` |
| `get(agentId, companyId)` | `(agentId: string, companyId: string) => Promise<Agent>` | `agents.read` |
| `pause(agentId, companyId)` | `(agentId: string, companyId: string) => Promise<Agent>` | `agents.pause` |
| `resume(agentId, companyId)` | `(agentId: string, companyId: string) => Promise<Agent>` | `agents.resume` |
| `invoke(agentId, companyId, params)` | `(agentId: string, companyId: string, params: { prompt, reason }) => Promise<unknown>` | `agents.invoke` |

### `ctx.agents.sessions`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `create(agentId, companyId, params)` | Returns `AgentSession` with `sessionId` | `agent.sessions.create` |
| `list(agentId, companyId)` | Returns `AgentSession[]` | `agent.sessions.list` |
| `sendMessage(sessionId, companyId, params)` | Sends message with `onEvent` callback | `agent.sessions.send` |
| `close(sessionId, companyId)` | Closes the session | `agent.sessions.close` |

### `ctx.goals`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `list(params)` | `(params: { companyId, limit, offset }) => Promise<Goal[]>` | `goals.read` |
| `get(goalId, companyId)` | `(goalId: string, companyId: string) => Promise<Goal>` | `goals.read` |
| `create(params)` | `(params: { companyId, title, description?, level, status }) => Promise<Goal>` | `goals.create` |
| `update(goalId, params, companyId)` | `(goalId: string, params: { status? }, companyId: string) => Promise<Goal>` | `goals.update` |

### `ctx.streams`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `open(channel, companyId)` | `(channel: string, companyId: string) => void` | none |
| `emit(channel, event)` | `(channel: string, event: unknown) => void` | none |
| `close(channel)` | `(channel: string) => void` | none |

Pushes events to the UI via SSE. The UI subscribes with `usePluginStream(channel)`.

### `ctx.tools`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `register(name, spec, handler)` | See agent tools section in authoring guide | `agent.tools.register` |

### `ctx.metrics`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `write(name, value, tags?)` | `(name: string, value: number, tags?: Record<string, string>) => Promise<void>` | `metrics.write` |

### `ctx.logger`

| Method | Signature | Capability |
|--------|-----------|-----------|
| `info(message, data?)` | `(message: string, data?: unknown) => void` | none (always available) |
| `warn(message, data?)` | `(message: string, data?: unknown) => void` | none |
| `error(message, data?)` | `(message: string, data?: unknown) => void` | none |
| `debug(message, data?)` | `(message: string, data?: unknown) => void` | none |

## UI SDK

Import from `@paperclipai/plugin-sdk/ui`.

### Hooks

| Hook | Returns | Purpose |
|------|---------|---------|
| `usePluginData<T>(key, params?)` | `PluginDataResult<T>` | Fetch data from worker |
| `usePluginAction(key)` | `PluginActionFn` | Trigger worker action |
| `usePluginStream<T>(channel, options?)` | `PluginStreamResult<T>` | Subscribe to SSE stream |
| `usePluginToast()` | `PluginToastFn` | Show host notifications |
| `useHostContext()` | `PluginHostContext` | Read current host context |

### `PluginDataResult<T>`

```typescript
{
  data: T | null;       // Worker response, null while loading
  loading: boolean;     // True during fetch
  error: PluginBridgeError | null;  // Error if fetch failed
  refresh(): void;      // Manually re-fetch
}
```

### `PluginActionFn`

```typescript
(params?: Record<string, unknown>) => Promise<unknown>
```

Plain async function. Throws `PluginBridgeError` on failure.

### `PluginToastFn`

```typescript
(input: {
  id?: string;
  dedupeKey?: string;
  title: string;
  body?: string;
  tone?: "info" | "success" | "warn" | "error";
  ttlMs?: number;
  action?: { label: string; href: string };
}) => string | null
```

### `PluginHostContext`

```typescript
{
  companyId: string | null;
  companyPrefix: string | null;
  projectId: string | null;
  entityId: string | null;
  entityType: string | null;
  parentEntityId?: string | null;
  userId: string | null;
  renderEnvironment?: PluginRenderEnvironmentContext | null;
}
```

### `PluginBridgeError`

```typescript
{
  code: "WORKER_UNAVAILABLE" | "CAPABILITY_DENIED" | "WORKER_ERROR" | "TIMEOUT" | "UNKNOWN";
  message: string;
  details?: unknown;  // Only when code is "WORKER_ERROR"
}
```

### Slot prop interfaces

| Interface | Fields beyond `context` |
|-----------|------------------------|
| `PluginPageProps` | none |
| `PluginWidgetProps` | none |
| `PluginSidebarProps` | none |
| `PluginSettingsPageProps` | none |
| `PluginDetailTabProps` | `context.entityId: string`, `context.entityType: string` |
| `PluginProjectSidebarItemProps` | `context.entityId: string`, `context.entityType: "project"` |
| `PluginCommentAnnotationProps` | `context.entityId: string` (comment ID), `context.entityType: "comment"`, `context.parentEntityId: string` (issue ID) |
| `PluginCommentContextMenuItemProps` | Same as `PluginCommentAnnotationProps` |

## SDK subpath exports

| Import path | Purpose |
|-------------|---------|
| `@paperclipai/plugin-sdk` | Worker: `definePlugin`, `runWorker`, types |
| `@paperclipai/plugin-sdk/ui` | UI: hooks, slot prop types |
| `@paperclipai/plugin-sdk/ui/hooks` | Hooks only |
| `@paperclipai/plugin-sdk/ui/types` | UI types only |
| `@paperclipai/plugin-sdk/testing` | `createTestHarness` for tests |
| `@paperclipai/plugin-sdk/bundlers` | `createPluginBundlerPresets` for esbuild/rollup |
| `@paperclipai/plugin-sdk/dev-server` | `startPluginDevServer` for hot-reload |
| `@paperclipai/plugin-sdk/protocol` | JSON-RPC protocol types (advanced) |
| `@paperclipai/plugin-sdk/types` | Worker context types (advanced) |
