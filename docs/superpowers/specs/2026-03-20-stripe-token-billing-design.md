# Stripe Token Billing Plugin — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Plugin ID:** `paperclip.stripe-billing`

## Overview

A Paperclip plugin that integrates with [Stripe's token billing](https://docs.stripe.com/billing/token-billing) to enable SaaS billing for LLM token usage. Allows operators to bill customers based on how many tokens their agents consume, pass through LLM costs with configurable markup, and track spend in Stripe for internal accounting.

### Goals

1. **Bill end users** — customers pay based on token consumption across their Paperclip companies
2. **Pass through LLM costs** — Stripe handles invoicing of actual provider costs + operator-configured markup
3. **Internal accounting** — all LLM spend flows through Stripe for financial tracking
4. **Credit controls** — agents are paused when payment fails or spending limits are exceeded

### Non-Goals (Phase 1)

- Stripe AI Gateway integration (Phase 2)
- Custom billing periods (uses Stripe's default monthly cycle)
- Per-action quotas or rate limiting (beyond budget-based pause)

## Architecture

### Integration Method

**Phase 1: Self-report via Stripe Meter API.** When a `cost_event` is created in Paperclip (after an agent run), the plugin pushes a meter event to Stripe. Stripe handles pricing, markup, invoicing, and payment collection.

**Phase 2 (future): Stripe AI Gateway.** Supported adapters route LLM calls through Stripe's gateway for automatic metering. Non-gateway adapters (bash, process, HTTP) continue using self-report. The Phase 1 data model and plugin structure remain unchanged — gateway support is additive.

### Plugin Positioning

Built as a Paperclip plugin, keeping the core open-source and billing as an optional add-on. Uses the existing plugin SDK capabilities:

- `cost_event.created` event subscription for real-time metering
- Webhooks for Stripe callback handling
- Scheduled jobs for reconciliation
- Plugin state and entities for billing data
- UI slots for billing dashboard

## Data Model

### Billing Account

A new concept that maps to a Stripe Customer. Owns one or more Paperclip companies. Stored as a plugin entity (`entityType: "billing-account"`).

```
billing-account (plugin_entities)
├── externalId: Stripe Customer ID (cus_xxx)
├── scopeKind: "instance"
├── data:
│   ├── name: string
│   ├── email: string
│   ├── stripeSubscriptionId: string (sub_xxx)
│   ├── status: "active" | "past_due" | "suspended" | "cancelled"
│   ├── markupPercent: number (default from plugin config)
│   ├── modelMarkupOverrides: { [model: string]: number }
│   └── companyIds: string[]
```

### Company Billing State

Per-company plugin state linking to the billing account (`scopeKind: "company"`, `namespace: "stripe-billing"`):

```
"billing-account-id": string         — which billing account owns this company
"stripe-customer-id": string         — denormalized for fast lookup
"last-synced-event-timestamp": string — ISO 8601 timestamp of last cost_event successfully sent to Stripe
```

### Invoice Records

Stripe invoices stored as plugin entities for UI display (`entityType: "stripe-invoice"`):

```
stripe-invoice (plugin_entities)
├── externalId: Stripe Invoice ID (in_xxx)
├── scopeKind: "instance" (filtered by billing account externalId)
├── data:
│   ├── amountCents: number
│   ├── status: "draft" | "open" | "paid" | "uncollectible" | "void"
│   ├── paidAt: string (ISO 8601)
│   ├── periodStart: string (ISO 8601)
│   ├── periodEnd: string (ISO 8601)
│   └── lineItems: Array<{ model, inputTokens, outputTokens, amountCents }>
```

### Failed Meter Events (Retry)

When a Stripe Meter API call fails, the event is stored as an individual plugin entity for retry. This avoids race conditions from concurrent read-modify-write on a shared array.

```
failed-meter-event (plugin_entities)
├── externalId: "<cost_event_id>-<token_type>" (matches the Stripe identifier)
├── entityType: "failed-meter-event"
├── scopeKind: "company"
├── scopeId: <company_id>
├── status: "pending" | "exhausted"
├── data:
│   ├── costEventId: string
│   ├── payload: MeterEventPayload
│   ├── failedAt: string (ISO 8601)
│   ├── attempts: number
│   └── lastError: string
```

## Event Flows

### Flow 1: Real-time Usage Reporting

```
Agent run completes
  → Adapter extracts tokens (input/output) + provider + model
  → Heartbeat service creates cost_event in Paperclip DB
  → Plugin receives cost_event.created event
  → Plugin looks up billing account for the company
    → If no billing account linked: skip (company is unlinked/unbilled)
  → Plugin formats Stripe meter events (one per token type):
      POST /v2/billing/meter_events
      {
        event_name: "llm_token_usage",
        payload: {
          stripe_customer_id: "cus_xxx",
          value: "<token_count>",
          model: "claude-opus-4-6",
          token_type: "input"
        },
        identifier: "<cost_event_id>-input"
      }
  → Send two events: one for input tokens, one for output tokens
  → identifier = cost_event.id + "-" + token_type (idempotency key, safe to retry)
  → On success: update last-synced-event-timestamp in plugin state
  → On failure: store as failed-meter-event plugin entity for retry
```

### Flow 2: Credit Controls (Payment Enforcement)

```
Stripe sends webhook → POST /api/plugins/paperclip.stripe-billing/webhooks/stripe
  → Plugin verifies stripe-signature header
  → Routes by event type:

  invoice.payment_failed:
    → Find billing account by Stripe Customer ID
    → Set billing account status to "past_due"
    → If autoSuspendOnPaymentFailure enabled:
      → Pause all agents in all linked companies (via ctx.agents)
      → Log activity: "Agents paused due to payment failure"

  invoice.paid:
    → Find billing account by Stripe Customer ID
    → Set billing account status to "active"
    → If agents were previously paused due to payment failure:
      → Resume agents
      → Log activity: "Agents resumed after payment received"

  customer.subscription.deleted:
    → Find billing account by Stripe Customer ID
    → Set billing account status to "cancelled"
    → Pause all agents in linked companies
    → Log activity: "Agents paused: subscription cancelled"

  invoice.finalized:
    → Store invoice as plugin entity (entityType: "stripe-invoice")
    → Log activity with invoice details
```

### Flow 3: Daily Reconciliation

```
Scheduled job runs (default: 2 AM UTC daily)
  → For each billing account with status "active":
    → Query failed-meter-event entities with status "pending"
      → Re-attempt each failed meter event
      → If still failing after 5 attempts: set status to "exhausted", alert via health
      → On success: delete the failed-meter-event entity
    → Query Paperclip cost_events since last-synced-event-timestamp
      → For any events without a corresponding successful meter push, report them
    → Update last-reconciliation-timestamp in plugin state
  → Report job metrics (accounts processed, events reconciled, errors)

Note: The reconciliation job relies on the timestamp cursor and failed-meter-event
entities for gap detection. The plugin does not have direct DB query access to
cost_events — it must derive reconciliation data from events it has received
and stored in plugin state during real-time processing.
```

## Plugin Configuration

### Operator Configuration (Instance-level)

```json
{
  "stripeSecretKey": "STRIPE_SECRET_KEY",
  "stripeWebhookSecret": "STRIPE_WEBHOOK_SECRET",
  "defaultMarkupPercent": 30,
  "autoSuspendOnPaymentFailure": true,
  "reconciliationSchedule": "0 2 * * *"
}
```

- `stripeSecretKey` and `stripeWebhookSecret` are secret references resolved via `ctx.secrets.resolve()`
- `defaultMarkupPercent` is the default markup applied to new billing accounts (can be overridden per account)
- `autoSuspendOnPaymentFailure` controls whether agents are auto-paused on payment failure
- `reconciliationSchedule` is a cron expression for the daily reconciliation job

### Plugin Manifest

```typescript
{
  id: "paperclip.stripe-billing",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Stripe Token Billing",
  description: "Bill customers for LLM token usage via Stripe",
  author: "Paperclip",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "companies.read",
    "agents.read",
    "agents.pause",
    "agents.resume",
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "secrets.read-ref",
    "jobs.schedule",
    "activity.log.write",
    "webhooks.receive",
    "ui.page.register",
    "ui.dashboardWidget.register",
    "ui.detailTab.register"
  ],
  instanceConfigSchema: {
    type: "object",
    properties: {
      stripeSecretKey: {
        type: "string",
        title: "Stripe Secret Key (Secret Ref)"
      },
      stripeWebhookSecret: {
        type: "string",
        title: "Stripe Webhook Secret (Secret Ref)"
      },
      defaultMarkupPercent: {
        type: "number",
        title: "Default Markup %",
        default: 30
      },
      autoSuspendOnPaymentFailure: {
        type: "boolean",
        title: "Auto-suspend on Payment Failure",
        default: true
      },
      reconciliationSchedule: {
        type: "string",
        title: "Reconciliation Schedule (cron)",
        default: "0 2 * * *"
      }
    },
    required: ["stripeSecretKey", "stripeWebhookSecret"]
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui/index.js"
  },
  webhooks: [
    {
      endpointKey: "stripe",
      displayName: "Stripe Webhook",
      description: "Receives payment and invoice events from Stripe"
    }
  ],
  jobs: [
    {
      jobKey: "reconcile-billing",
      displayName: "Reconcile Billing",
      description: "Daily reconciliation of meter events with Stripe",
      schedule: "0 2 * * *"
    }
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: "billing-page",
        displayName: "Billing",
        exportName: "BillingPage",
        routePath: "billing"
      },
      {
        type: "dashboardWidget",
        id: "billing-widget",
        displayName: "Billing Summary",
        exportName: "BillingWidget"
      },
      {
        type: "detailTab",
        id: "company-billing-tab",
        displayName: "Billing",
        exportName: "CompanyBillingTab",
        entityTypes: ["company"]
      }
    ]
  }
}
```

## File Structure

```
plugins/stripe-billing/
├── src/
│   ├── manifest.ts              Plugin metadata and config schema
│   ├── worker.ts                Entry point: setup + lifecycle hooks
│   ├── handlers/
│   │   ├── cost-event.ts        cost_event.created → Stripe meter event
│   │   ├── webhook.ts           Stripe webhook → pause/resume agents
│   │   └── reconcile.ts         Daily reconciliation job
│   ├── services/
│   │   ├── stripe.ts            Stripe REST API client (via ctx.http)
│   │   ├── accounts.ts          Billing account CRUD (plugin entities)
│   │   ├── meter.ts             Meter event formatting, idempotency, retry
│   │   └── invoices.ts          Invoice entity management
│   ├── types.ts                 Shared TypeScript types
│   └── ui/
│       ├── index.tsx            UI entry point (exports all components)
│       ├── BillingPage.tsx      Full billing dashboard
│       ├── BillingWidget.tsx    Dashboard summary widget
│       └── CompanyBillingTab.tsx Per-company billing details
├── package.json
└── tsconfig.json
```

## UI

### Billing Dashboard Page (`/billing`)

Accessible from the sidebar. Contains:

- **Billing accounts table** — name, email, status badge (active/past_due/suspended/cancelled), linked companies count, current period usage (tokens + estimated revenue)
- **Create billing account** button — form to create a Stripe Customer + subscription, select companies to link
- **Global metrics bar** — total MRR, total tokens this period, count of past_due accounts

### Dashboard Widget

Summary card on the main dashboard:

- Total billable usage this period (tokens + estimated revenue at markup)
- Active / past_due account counts
- Link to full billing page

### Company Billing Tab

A tab on company detail views:

- Billing account assignment (linked account name or "Unlinked" with assign button)
- Token usage breakdown for current period (by model, input vs output)
- Estimated billable amount at current markup
- Recent invoices for this company's billing account

### Billing Account Management

**Create account:**
1. Operator enters customer name + email + optional markup override
2. Plugin creates Stripe Customer via API
3. Plugin creates Stripe Subscription with token billing metered prices
4. Plugin creates billing-account plugin entity
5. Operator selects companies to link

**Link/unlink companies:**
- Select companies from a list to assign to a billing account
- Unlinked companies' usage is tracked internally but not reported to Stripe

**Manual suspend/resume:**
- Operator can manually suspend a billing account (pauses linked agents)
- Operator can resume a suspended account

## Pricing Model

### Phase 1: Usage-based

- Input tokens and output tokens priced separately per model
- Stripe's token billing handles provider rate tracking
- Operator configures markup percentage (global default, per-account override, per-model override)
- No fixed monthly fee

### Phase 2 extension: Subscription + usage

- Add a fixed monthly base price to the Stripe subscription
- Optional token allowance (included tokens before overage kicks in)
- No structural changes needed — just additional Stripe price items on the subscription

### Markup Application

Markup is applied at the **Stripe Price layer**, not to meter event values. Meter events always report raw token counts. When creating a billing account's Stripe Subscription, the plugin configures Stripe Prices with the appropriate markup built into the per-token rate.

**Markup resolution order** (used when creating/updating Stripe Prices):

1. Billing account's `modelMarkupOverrides[model]` (most specific)
2. Billing account's `markupPercent` (account-level default)
3. Plugin config `defaultMarkupPercent` (global default)

When markup settings change on a billing account, the plugin updates the corresponding Stripe Prices for the next billing period.

## Key Design Decisions

1. **No direct Stripe SDK** — use `ctx.http.fetch()` for Stripe REST API calls. Keeps the plugin lightweight, avoids SDK version coupling, and stays within plugin SDK constraints.

2. **Idempotent meter events** — use `cost_event.id + "-" + token_type` as the Stripe meter event `identifier` (idempotency key). Safe to retry without double-billing.

3. **Retry via plugin entities** — failed meter events are stored as individual `failed-meter-event` plugin entities (not a shared JSON array) to avoid concurrency issues. The reconciliation job retries them. Max 5 attempts before marking as exhausted and alerting.

4. **Webhook signature verification** — `onWebhook` verifies the `stripe-signature` header using the webhook secret before processing any event. Invalid signatures are rejected.

5. **Billing account as plugin entity** — not a core Paperclip concept. Uses `plugin_entities` table, keeping the core schema clean.

6. **Agent pause/resume for credit controls** — leverages existing `ctx.agents` SDK to pause agents on payment failure. Agents are tagged with pause reason so they can be selectively resumed.

7. **Unlinked companies are unbilled** — companies not assigned to a billing account have their usage tracked internally (existing cost_events) but nothing is reported to Stripe. This allows gradual rollout.

8. **Health checks** — `onHealth()` verifies Stripe API reachability, reports pending failed-meter-event count, and time since last successful meter event. Returns `degraded` if retry queue is growing or Stripe is unreachable.

9. **Graceful shutdown** — `onShutdown()` allows in-flight meter event HTTP calls to complete (up to 10s timeout). Any events that can't complete are stored as failed-meter-event entities for the reconciliation job to pick up.

## Phase 2: Gateway Support (Future)

The design accommodates the Stripe AI Gateway without restructuring:

- **Adapter config option:** `llmRouting: "direct" | "stripe-gateway"` per agent
- **Gateway-routed adapters** pass LLM calls through Stripe's gateway — Stripe meters automatically, plugin skips self-reporting for those events (detected via a `source: "gateway"` flag on the cost event)
- **Non-gateway adapters** (bash, process, HTTP) continue self-reporting
- **Reverse sync:** Gateway usage flows back into Paperclip's `cost_events` for budget enforcement via Stripe webhook or polling
- **No breaking changes** to the Phase 1 data model or plugin structure

## Testing Strategy

- **Unit tests:** Stripe API client, meter event formatting, markup resolution, retry logic
- **Integration tests:** cost_event.created → meter event flow (mocked Stripe API), webhook → agent pause/resume flow
- **E2E tests:** Full cycle — create billing account, run agent, verify meter event in Stripe test mode, verify invoice generation
- **Reconciliation tests:** Simulate missed events, verify reconciliation job catches and reports them

## Security Considerations

- Stripe API keys stored as secret references, never in plugin state or logs
- Webhook signature verification on all inbound Stripe events
- Plugin only has access to declared capabilities (no direct DB access)
- Billing account data scoped appropriately via plugin entity system
- No PII beyond customer name/email (which Stripe also stores)
