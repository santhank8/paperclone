import type {
  WebhookConfig,
  WebhookActionRule,
  WebhookEvent,
  WebhookIssueLink,
  CreateWebhookConfig,
  UpdateWebhookConfig,
  CreateWebhookActionRule,
  UpdateWebhookActionRule,
  CreateWebhookIssueLink,
} from "@paperclipai/shared";
import { api } from "./client";

export const webhooksApi = {
  // Configs
  list: (companyId: string) =>
    api.get<WebhookConfig[]>(`/companies/${companyId}/webhooks`),
  get: (id: string) => api.get<WebhookConfig>(`/webhooks/${id}`),
  create: (companyId: string, data: CreateWebhookConfig) =>
    api.post<WebhookConfig>(`/companies/${companyId}/webhooks`, data),
  update: (id: string, data: UpdateWebhookConfig) =>
    api.patch<WebhookConfig>(`/webhooks/${id}`, data),
  remove: (id: string) => api.delete<{ ok: true }>(`/webhooks/${id}`),
  regenerateToken: (id: string) =>
    api.post<WebhookConfig>(`/webhooks/${id}/regenerate-token`, {}),

  // Rules
  listRules: (webhookId: string) =>
    api.get<WebhookActionRule[]>(`/webhooks/${webhookId}/rules`),
  createRule: (webhookId: string, data: CreateWebhookActionRule) =>
    api.post<WebhookActionRule>(`/webhooks/${webhookId}/rules`, data),
  updateRule: (ruleId: string, data: UpdateWebhookActionRule) =>
    api.patch<WebhookActionRule>(`/webhook-rules/${ruleId}`, data),
  removeRule: (ruleId: string) =>
    api.delete<{ ok: true }>(`/webhook-rules/${ruleId}`),

  // Events
  listEvents: (companyId: string) =>
    api.get<WebhookEvent[]>(`/companies/${companyId}/webhook-events`),

  // Issue links
  listIssueLinks: (issueId: string) =>
    api.get<WebhookIssueLink[]>(`/issues/${issueId}/webhook-links`),
  createIssueLink: (issueId: string, data: CreateWebhookIssueLink) =>
    api.post<WebhookIssueLink>(`/issues/${issueId}/webhook-links`, data),
  removeIssueLink: (linkId: string) =>
    api.delete<{ ok: true }>(`/webhook-links/${linkId}`),
};
