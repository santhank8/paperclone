import crypto from "node:crypto";
import type { Db } from "@paperclipai/db";
import { webhooks } from "@paperclipai/db";
import type { WebhookEventType } from "@paperclipai/shared";
import { eq, and } from "drizzle-orm";

export interface WebhookPayload {
  event: string;
  companyId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliver(url: string, payload: WebhookPayload, secret?: string | null) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Paperclip-Webhooks/1.0",
  };
  if (secret) {
    headers["X-Paperclip-Signature"] = `sha256=${sign(body, secret)}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    // Fire-and-forget: log but don't throw so we don't block the caller.
    console.warn(`[webhooks] delivery failed for ${url}: ${err instanceof Error ? err.message : err}`);
  }
}

export function webhookService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select({
          id: webhooks.id,
          companyId: webhooks.companyId,
          url: webhooks.url,
          events: webhooks.events,
          enabled: webhooks.enabled,
          description: webhooks.description,
          createdAt: webhooks.createdAt,
          updatedAt: webhooks.updatedAt,
        })
        .from(webhooks)
        .where(eq(webhooks.companyId, companyId));
    },

    async getById(id: string) {
      const rows = await db.select().from(webhooks).where(eq(webhooks.id, id));
      return rows[0] ?? null;
    },

    async create(
      companyId: string,
      input: { url: string; secret?: string | null; events: string[]; description?: string | null; enabled?: boolean },
    ) {
      const rows = await db
        .insert(webhooks)
        .values({
          companyId,
          url: input.url,
          secret: input.secret ?? null,
          events: input.events,
          description: input.description ?? null,
          enabled: input.enabled ?? true,
        })
        .returning();
      return rows[0];
    },

    async update(id: string, input: Partial<{ url: string; secret: string | null; events: string[]; description: string | null; enabled: boolean }>) {
      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (input.url !== undefined) values.url = input.url;
      if (input.secret !== undefined) values.secret = input.secret;
      if (input.events !== undefined) values.events = input.events;
      if (input.description !== undefined) values.description = input.description;
      if (input.enabled !== undefined) values.enabled = input.enabled;

      const rows = await db.update(webhooks).set(values).where(eq(webhooks.id, id)).returning();
      return rows[0] ?? null;
    },

    async remove(id: string) {
      const rows = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
      return rows[0] ?? null;
    },

    async dispatch(companyId: string, event: WebhookEventType, data: Record<string, unknown>) {
      const hooks = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.companyId, companyId), eq(webhooks.enabled, true)));

      const matching = hooks.filter((h) => {
        const events = h.events as string[];
        return events.includes(event) || events.includes("*");
      });

      if (matching.length === 0) return;

      const payload: WebhookPayload = {
        event,
        companyId,
        timestamp: new Date().toISOString(),
        data,
      };

      await Promise.allSettled(matching.map((h) => deliver(h.url, payload, h.secret)));
    },
  };
}

// Exported for testing
export { sign as _signForTest, deliver as _deliverForTest };
