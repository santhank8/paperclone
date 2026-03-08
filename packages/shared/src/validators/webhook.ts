import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = [
  "approval.created",
  "approval.approved",
  "approval.rejected",
  "run.succeeded",
  "run.failed",
  "run.timed_out",
  "agent.status",
  "issue.created",
  "issue.updated",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export type CreateWebhook = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(8).optional().nullable(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhook = z.infer<typeof updateWebhookSchema>;
