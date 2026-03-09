# Notification Channels for Paperclip

**Date:** 2026-03-08
**Status:** Ready for planning
**Related:** Issue #26 (Support push notifications via ntfy.sh)

## What We're Building

A notification channel system that follows Paperclip's existing adapter pattern — shared interface, concrete implementations, registry — to deliver external push notifications when agent events happen. Ships with Discord webhook and ntfy.sh as the first two channel types.

Today Paperclip has zero external notifications. If an agent fails at 3 AM, nobody knows until they open the UI. This adds configurable, per-company notification channels that push color-coded alerts to Discord, ntfy.sh, or any future backend (Slack, email, SMS) without touching core.

## Why This Approach

The adapter pattern already exists in the codebase (`packages/adapters/`, `ServerAdapterModule` interface, registry `Map`). We're not inventing a new abstraction — we're following the one Paperclip already uses. A `NotificationChannel` interface with `send()` and `testConnection()` is the notification equivalent of `ServerAdapterModule` with `execute()` and `testEnvironment()`.

This also addresses issue #26 (ntfy.sh support) while going further. One contribution, two channel backends, and a clear path for the community to add more.

## Key Decisions

### 1. Architecture: Follow the adapter pattern

```
packages/notifiers/
  discord/          # Discord webhook embeds
  ntfy/             # ntfy.sh HTTP push
```

Shared interface:

```typescript
export interface NotificationChannel {
  type: string;
  send(event: NotificationEvent, config: ChannelConfig): Promise<void>;
  testConnection(config: ChannelConfig): Promise<{ ok: boolean; error?: string }>;
}
```

Registry in server: `Map<string, NotificationChannel>` — same pattern as `server/src/adapters/registry.ts`.

### 2. Configuration: Database table, multi-channel per company

New `notification_channels` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| company_id | uuid | FK to companies |
| channel_type | text | "discord", "ntfy", etc. |
| name | text | User-facing label ("Discord #agent-ops") |
| config | jsonb | Channel-specific config (webhook_url, topic, etc.) |
| event_filter | text[] | Which event types to forward |
| enabled | boolean | Toggle without deleting |
| created_at | timestamp | |
| updated_at | timestamp | |

One company can have multiple channels — Discord for failures, ntfy for everything, etc.

### 3. Events: Configurable filter per channel

Each channel instance specifies which event types it wants. Available event types map to the existing live event system:

- `run.succeeded`, `run.failed`, `run.timed_out`, `run.cancelled`
- `agent.error`, `agent.status_changed`
- `approval.created`, `approval.decided`
- `issue.created`, `issue.updated`, `issue.commented`
- `budget.threshold` (if/when budget warnings exist)

The notification service subscribes to `activity.logged` and `heartbeat.run.status` events, maps them to notification event types, checks each company's enabled channels, and dispatches to matching channels.

### 4. UI: Minimal settings page in first PR

- Channel type dropdown + config fields + save button
- Add/edit/delete channel instances
- Enable/disable toggle
- Event filter checkboxes and test connection button can follow in subsequent PRs

### 5. Contribution strategy: Build it, open PR

Ship a working PR with tests. Reference issue #26. Let the code speak for itself.

## Scope Breakdown

| Layer | What | Touches |
|-------|------|---------|
| Shared types | `NotificationChannel` interface, event types, config types | `packages/shared/` or new `packages/notifier-utils/` |
| Discord notifier | Discord webhook embed formatting, color-coded statuses | `packages/notifiers/discord/` (new) |
| ntfy notifier | ntfy.sh HTTP POST, priority mapping | `packages/notifiers/ntfy/` (new) |
| DB migration | `notification_channels` table | `packages/db/` |
| Server service | Event listener, channel registry, dispatch loop | `server/src/services/` |
| API routes | CRUD endpoints for notification channels | `server/src/routes/` |
| UI settings | Minimal settings page for managing channels | `ui/src/pages/` |
| Workspace config | Add new packages to `pnpm-workspace.yaml` | root |

## Open Questions

1. **PR size** — This touches ~8 areas. Should it be split into multiple PRs (backend first, UI second) or shipped as one cohesive PR?
2. **Secret handling** — Webhook URLs are secrets. Should they use the existing secrets provider, or is config JSON sufficient for V1?
3. **Rate limiting** — Should the notification service rate-limit outbound messages per channel to avoid webhook bans?
4. **Retry policy** — On send failure, retry with backoff or fire-and-forget?
5. **Plugin spec alignment** — The plugin spec defines a `connector` category and event subscriptions. Should the notification channel interface mirror the plugin SDK's event contract for easier extraction later?

## Next Steps

Run `/workflows:plan` to break this into implementation tasks.
