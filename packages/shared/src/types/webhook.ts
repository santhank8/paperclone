export interface WebhookConfig {
  id: string;
  companyId: string;
  projectId: string | null;
  name: string;
  provider: string;
  token: string;
  secret: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookActionRule {
  id: string;
  webhookConfigId: string;
  eventType: string;
  action: string;
  actionParams: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  webhookConfigId: string | null;
  companyId: string;
  provider: string;
  eventType: string;
  deliveryId: string | null;
  payload: Record<string, unknown> | null;
  headers: Record<string, unknown> | null;
  status: string;
  errorMessage: string | null;
  matchedIssues: Record<string, unknown>[] | null;
  processingMs: number | null;
  createdAt: string;
}

export interface WebhookIssueLink {
  id: string;
  companyId: string;
  issueId: string;
  provider: string;
  externalType: string;
  externalId: string;
  createdAt: string;
}
