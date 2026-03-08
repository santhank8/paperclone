import type { Db } from "@paperclipai/db";
import type { LiveEvent } from "@paperclipai/shared";
import type { WebhookEventType } from "@paperclipai/shared";
import { webhookService } from "./webhooks.js";
import { subscribeCompanyLiveEvents } from "./live-events.js";

/**
 * Map activity log actions to webhook event types.
 * Returns null if the action doesn't map to a webhook event.
 */
function mapActivityToWebhookEvent(action: string): WebhookEventType | null {
  const mapping: Record<string, WebhookEventType> = {
    "approval.created": "approval.created",
    "approval.approved": "approval.approved",
    "approval.rejected": "approval.rejected",
    "issue.created": "issue.created",
    "issue.updated": "issue.updated",
    "issue.status_changed": "issue.updated",
  };
  return mapping[action] ?? null;
}

/**
 * Map heartbeat run status events to webhook event types.
 */
function mapRunStatusToWebhookEvent(status: string): WebhookEventType | null {
  const mapping: Record<string, WebhookEventType> = {
    succeeded: "run.succeeded",
    failed: "run.failed",
    timed_out: "run.timed_out",
  };
  return mapping[status] ?? null;
}

const subscribedCompanies = new Set<string>();

/**
 * Subscribe to live events for a company and dispatch matching webhooks.
 * Call this when a company is accessed or at startup for known companies.
 */
export function ensureWebhookSubscription(db: Db, companyId: string) {
  if (subscribedCompanies.has(companyId)) return;
  subscribedCompanies.add(companyId);

  const svc = webhookService(db);

  subscribeCompanyLiveEvents(companyId, (event: LiveEvent) => {
    let webhookEvent: WebhookEventType | null = null;
    let data: Record<string, unknown> = event.payload;

    if (event.type === "activity.logged") {
      const action = (event.payload?.action as string) ?? "";
      webhookEvent = mapActivityToWebhookEvent(action);
    } else if (event.type === "heartbeat.run.status") {
      const status = (event.payload?.status as string) ?? "";
      webhookEvent = mapRunStatusToWebhookEvent(status);
    } else if (event.type === "agent.status") {
      webhookEvent = "agent.status";
    }

    if (webhookEvent) {
      svc.dispatch(companyId, webhookEvent, data).catch((err) => {
        console.warn(`[webhook-dispatcher] dispatch error for ${companyId}: ${err}`);
      });
    }
  });
}

/**
 * Initialize webhook subscriptions for all existing companies.
 * Called at server startup.
 */
export async function initWebhookDispatcher(db: Db) {
  const { companies } = await import("@paperclipai/db");
  const allCompanies = await db.select({ id: companies.id }).from(companies);
  for (const company of allCompanies) {
    ensureWebhookSubscription(db, company.id);
  }
}
