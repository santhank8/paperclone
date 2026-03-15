# Slack Connector for Paperclip

Bidirectional Slack integration for Paperclip. Create, update, and manage issues from Slack. Get approval notifications with interactive buttons. React with emoji to change status.

## Features

### Outbound (Paperclip → Slack)

- **Issue created** → Block Kit message posted to configured channel
- **Issue updated** → Message updated with new status/priority
- **Comment added** → Posted as thread reply
- **Approval requested** → Approval card with Approve/Reject buttons
- **Approval decided** → Card updated with decision result

### Inbound (Slack → Paperclip)

- `/paperclip create [title]` — Create a new issue
- `/paperclip status` — Show active issues
- `/paperclip help` — Show available commands
- **Thread replies** → Added as issue comments
- **Emoji reactions** → Change issue status (✅ done, 🚀 in progress, 🔴 blocked, 👀 in review)
- **Button clicks** → Change issue status or approve/reject

### Security

- HMAC-SHA256 webhook signature verification
- Replay attack prevention (5-minute timestamp drift window)
- Secrets resolved at runtime via Paperclip secret provider

### Resilience

- All outbound handlers wrapped in try/catch — Slack API failures are logged, not fatal
- Echo prevention — changes from Slack don't bounce back to Slack
- Graceful degradation — works without signing secret (verification skipped)

## Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Add Bot Token Scopes: `chat:write`, `reactions:read`, `commands`
3. Install to your workspace

### 2. Configure Webhooks

Set these Request URLs in your Slack app:

| Slack Feature | URL |
|---------------|-----|
| Event Subscriptions | `{paperclip-url}/api/plugins/connector-slack/webhooks/slack-events` |
| Interactivity | `{paperclip-url}/api/plugins/connector-slack/webhooks/slack-interactive` |
| Slash Commands (`/paperclip`) | `{paperclip-url}/api/plugins/connector-slack/webhooks/slack-commands` |

Subscribe to these bot events: `message.channels`, `reaction_added`

### 3. Store Secrets in Paperclip

Add your Slack Bot Token (`xoxb-...`) and Signing Secret as Paperclip secrets.

### 4. Install Plugin

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/absolute/path/to/connector-slack","isLocalPath":true}'
```

### 5. Configure Plugin

In the Paperclip plugin settings, set:
- **Bot Token Reference** — name of the Paperclip secret containing your `xoxb-...` token
- **Signing Secret Reference** — name of the Paperclip secret containing the signing secret
- **Default Channel** — Slack channel ID for issues without a project mapping

### 6. Map Channels to Projects

Use the plugin actions to map Slack channels to Paperclip projects:

```bash
# Set default channel
curl -X POST http://127.0.0.1:3100/api/plugins/connector-slack/actions/set-default-channel \
  -H "Content-Type: application/json" \
  -d '{"channelId":"C0123456789"}'

# Map a project to a channel
curl -X POST http://127.0.0.1:3100/api/plugins/connector-slack/actions/set-project-channel \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj_xxx","channelId":"C_FRONTEND"}'
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test        # 23 tests
pnpm build
```

## Architecture

```
src/
├── constants.ts   # Plugin ID, webhook keys, status/reaction maps
├── echo.ts        # TTL-based echo prevention
├── verify.ts      # Slack HMAC-SHA256 signature verification
├── slack-api.ts   # Slack Web API client + Block Kit builders
├── mapping.ts     # Bidirectional issue↔thread mapping (ctx.state)
├── manifest.ts    # Plugin manifest
├── worker.ts      # Main plugin: event handlers, webhook handlers
└── ui/index.tsx   # Settings page
```
