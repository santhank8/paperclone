---
title: "feat: Add email notifier plugin using plugin SDK"
type: feat
date: 2026-03-09
depends_on: "PR #396 (Plugin Support)"
---

# feat: Add email notifier plugin using plugin SDK

## Overview

Add an email notification plugin for Paperclip using the plugin SDK from PR #396. Supports Resend and SendGrid as email providers. Follows the exact pattern established by the ntfy notifier example plugin — `definePlugin`/`runWorker`, event subscription via `ctx.events.on()`, delivery via `ctx.http.fetch()`, API key resolved via `ctx.secrets.resolve()`.

This is the third community-authored notifier (after webhook and Discord), completing the "big three" notification channels every engineering team needs.

## Problem Statement / Motivation

Email is the one channel every team already has configured. Webhook requires custom integration work. Discord/Slack/ntfy require additional service adoption. Email works everywhere out of the box — it's the universal fallback.

Building this as a plugin SDK plugin (not a built-in notifier backend) validates the plugin ecosystem and demonstrates that third-party authors can build notification channels without touching core Paperclip code.

## Proposed Solution

A standalone plugin package at `packages/plugins/paperclip-email-notifier/` that:

1. Declares a manifest with `events.subscribe`, `http.outbound`, `secrets.read-ref`, `metrics.write`, and `activity.log.write` capabilities
2. Subscribes to all core domain events (agent runs, issues, approvals, costs)
3. Filters events through a configurable allowlist
4. Formats events as HTML emails with plain-text fallback
5. Dispatches via Resend or SendGrid HTTP APIs (provider-selectable)
6. Resolves API keys from Paperclip secret refs (never stored in plaintext config)
7. Tracks send/failure metrics

**Config schema (instanceConfigSchema):**

```json
{
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["resend", "sendgrid"],
      "description": "Email API provider",
      "default": "resend"
    },
    "apiKeySecretRef": {
      "type": "string",
      "description": "Paperclip secret reference containing the provider API key"
    },
    "fromAddress": {
      "type": "string",
      "description": "Sender email address (must be verified with your provider)"
    },
    "fromName": {
      "type": "string",
      "description": "Sender display name",
      "default": "Paperclip"
    },
    "toAddresses": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Recipient email addresses (max 20)",
      "minItems": 1,
      "maxItems": 20
    },
    "subjectPrefix": {
      "type": "string",
      "description": "Prefix for email subject lines",
      "default": "[Paperclip]"
    },
    "eventAllowlist": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional list of event types to forward. Empty = all events."
    }
  },
  "required": ["provider", "apiKeySecretRef", "fromAddress", "toAddresses"]
}
```

## Technical Approach

### Files to Create

#### 1. `packages/plugins/paperclip-email-notifier/package.json`

```json
{
  "name": "@paperclipai/plugin-email-notifier",
  "version": "0.1.0",
  "description": "Email notifier plugin for Paperclip — sends event notifications via Resend or SendGrid",
  "type": "module",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js"
  },
  "scripts": {
    "prebuild": "node ../../../../scripts/ensure-plugin-build-deps.mjs",
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "typescript": "^5.7.3"
  }
}
```

#### 2. `packages/plugins/paperclip-email-notifier/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

#### 3. `packages/plugins/paperclip-email-notifier/src/index.ts`

```typescript
export { default as manifest } from "./manifest.js";
export { default as plugin } from "./worker.js";
```

#### 4. `packages/plugins/paperclip-email-notifier/src/manifest.ts`

Manifest declaring plugin metadata, capabilities, and config schema. Capabilities: `events.subscribe`, `http.outbound`, `secrets.read-ref`, `metrics.write`, `activity.log.write`.

#### 5. `packages/plugins/paperclip-email-notifier/src/worker.ts`

Main plugin implementation. Structure mirrors the ntfy notifier example:

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const METRIC_SENT = "email_notifications_sent";
const METRIC_FAILED = "email_notification_failures";

// Provider-specific request builders
interface EmailRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function buildResendRequest(apiKey: string, from: string, to: string[], subject: string, html: string, text: string): EmailRequest {
  return {
    url: "https://api.resend.com/emails",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  };
}

function buildSendGridRequest(apiKey: string, from: string, to: string[], subject: string, html: string, text: string): EmailRequest {
  return {
    url: "https://api.sendgrid.com/v3/mail/send",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: to.map(email => ({ email })) }],
      from: { email: from },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    // Config parsing, event subscription, email formatting,
    // and delivery logic — follows ntfy example pattern exactly.
    // See "Event Handling Pattern" section below.
  },

  async onValidateConfig(config) {
    // Validate required fields, email format, provider enum
  },

  async onHealth() {
    return { status: "ok", message: "Email notifier plugin ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### Event Handling Pattern

Follows the ntfy example's `handleEvent` helper:

```typescript
const handleEvent = (eventName, params, afterSend?) => {
  ctx.events.on(eventName, async (event) => {
    const config = await getParsedConfig();
    if (config.allowlist.length > 0 && !config.allowlist.includes(event.eventType)) return;

    const subject = `${config.subjectPrefix} ${params.label}`;
    const html = renderHtmlEmail(event, params);
    const text = renderPlainTextEmail(event, params);
    const delivered = await sendEmail(config, subject, html, text);

    if (delivered && afterSend) await afterSend(event, config);
  });
};
```

### Email Template

Clean, minimal HTML. No heavy branding — just structured event data:

```
Subject: [Paperclip] Agent Run Failed

+------------------------------------------+
| Agent Run Failed                    [red] |
|                                          |
| Actor:  agent (agent-uuid)               |
| Entity: run (run-uuid)                   |
| Status: failed                           |
| Error:  Connection timeout after 30s     |
|                                          |
| Occurred: 2026-03-09 14:23:00 UTC        |
+------------------------------------------+
| Paperclip — Agent Control Plane          |
+------------------------------------------+
```

Event-specific colors (inline CSS): green for success, red for failure, amber for warnings/approvals, blue for info.

Plain-text fallback included for every email (required by both Resend and SendGrid, improves deliverability).

### Provider Dispatch

Single API call per event with all recipients in one request. Both Resend and SendGrid support recipient arrays natively. If any address is invalid, the provider rejects the whole request — this is acceptable for a notification system (admin should validate addresses during setup).

### Key Design Decisions

1. **Plugin SDK, not built-in backend** — Validates the plugin ecosystem. Does not require modifying `NOTIFICATION_CHANNEL_TYPES`, `registry.ts`, or `notification.ts`. Zero changes to core Paperclip code.

2. **Resend + SendGrid only** — Both use simple Bearer token auth + JSON POST. AWS SES requires Signature V4 (complex, needs `@aws-sdk/client-sesv2`). Generic SMTP needs `nodemailer` (adds a heavy dependency). Start with the two simplest providers, add others later if needed.

3. **No SSRF check needed** — Provider URLs are hardcoded constants (`api.resend.com`, `api.sendgrid.com`), not user-supplied. Unlike webhook/Discord/ntfy which accept arbitrary URLs.

4. **10-second timeout** — Consistent with all existing notifiers. Email APIs are fast (they accept the request, delivery is async).

5. **Fire-and-forget, no retry** — Consistent with the ntfy plugin and the built-in dispatch pattern (`Promise.allSettled`, errors logged but not retried). Metrics track failures for observability.

6. **Single batched API call** — One request per event with all recipients. Simpler, fewer API calls, consistent failure model. If a recipient is invalid, admin sees the failure in metrics and fixes config.

7. **Plain-text + HTML dual format** — Maximizes deliverability. Corporate mail filters prefer multipart emails. Both providers support it natively.

8. **Subject prefix is user-configurable** — Defaults to `[Paperclip]`. Stripped of newlines to prevent header injection.

9. **Secret ref for API key** — API key is never stored in config directly. Resolved at send time via `ctx.secrets.resolve()`, which means key rotation is automatic.

10. **Validate eventAllowlist entries** — `onValidateConfig()` checks that allowlist entries are recognized event names. Prevents silent misconfiguration where a typo causes events to be dropped.

## Acceptance Criteria

- [ ] `packages/plugins/paperclip-email-notifier/` created with manifest, worker, index, package.json, tsconfig.json
- [ ] Manifest declares correct capabilities: `events.subscribe`, `http.outbound`, `secrets.read-ref`, `metrics.write`, `activity.log.write`
- [ ] Plugin subscribes to all core domain events (agent.run.*, agent.status_changed, issue.*, approval.*, cost_event.created)
- [ ] eventAllowlist filtering works (empty = all events, populated = only matching)
- [ ] `onValidateConfig()` validates: provider is "resend" or "sendgrid", apiKeySecretRef present, fromAddress is valid email, toAddresses has 1-20 valid emails, eventAllowlist entries are recognized
- [ ] Resend provider: sends correct POST to `api.resend.com/emails` with Bearer auth
- [ ] SendGrid provider: sends correct POST to `api.sendgrid.com/v3/mail/send` with correct `personalizations` structure
- [ ] HTML email includes: event label, actor, entity, status, error (if present), timestamp
- [ ] Plain-text fallback included in every email
- [ ] Subject line: `{subjectPrefix} {Event Label}` with newlines stripped from prefix
- [ ] API key resolved via `ctx.secrets.resolve()` on every send (supports rotation)
- [ ] Metrics tracked: `email_notifications_sent`, `email_notification_failures`
- [ ] `onHealth()` returns meaningful status
- [ ] TypeScript builds cleanly (`pnpm typecheck` from plugin dir)

## Dependencies & Risks

**Hard dependency:** PR #396 (Plugin Support) must be merged first. The plugin SDK (`@paperclipai/plugin-sdk`) is introduced in that PR.

**Provider-side risks:**
- Resend free tier: 100 emails/day, 1 email/second. Burst events could hit limits.
- SendGrid free tier: 100 emails/day. Same constraint.
- Both providers require sender domain verification. `testConnection()` will surface this clearly.

**No database migration needed.** Plugin config is stored via the plugin system's own tables (introduced in PR #396), not the `notification_channels` table.

## References

- ntfy plugin example (reference impl): `packages/plugins/examples/plugin-ntfy-notifier-example/src/worker.ts` (PR #396)
- Plugin SDK README: `packages/plugins/sdk/README.md` (PR #396)
- Plugin Authoring Guide: `doc/plugins/PLUGIN_AUTHORING_GUIDE.md` (PR #396)
- Resend API: https://resend.com/docs/api-reference/emails/send-email
- SendGrid API: https://docs.sendgrid.com/api-reference/mail-send/mail-send
