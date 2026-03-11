import { z } from "zod";
import { WEBHOOK_PROVIDERS, WEBHOOK_ACTIONS, WEBHOOK_EXTERNAL_TYPES, ISSUE_STATUSES } from "../constants.js";

export const createWebhookConfigSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(WEBHOOK_PROVIDERS).optional().default("github"),
  projectId: z.string().uuid().optional().nullable(),
  secret: z.string().optional().nullable(),
});

export type CreateWebhookConfig = z.infer<typeof createWebhookConfigSchema>;

export const updateWebhookConfigSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.enum(WEBHOOK_PROVIDERS).optional(),
  projectId: z.string().uuid().optional().nullable(),
  secret: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhookConfig = z.infer<typeof updateWebhookConfigSchema>;

export const createWebhookActionRuleSchema = z.object({
  eventType: z.string().min(1),
  action: z.enum(WEBHOOK_ACTIONS),
  actionParams: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export type CreateWebhookActionRule = z.infer<typeof createWebhookActionRuleSchema>;

export const updateWebhookActionRuleSchema = z.object({
  eventType: z.string().min(1).optional(),
  action: z.enum(WEBHOOK_ACTIONS).optional(),
  actionParams: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhookActionRule = z.infer<typeof updateWebhookActionRuleSchema>;

export const createWebhookIssueLinkSchema = z.object({
  provider: z.enum(WEBHOOK_PROVIDERS),
  externalType: z.enum(WEBHOOK_EXTERNAL_TYPES),
  externalId: z.string().min(1),
});

export type CreateWebhookIssueLink = z.infer<typeof createWebhookIssueLinkSchema>;
