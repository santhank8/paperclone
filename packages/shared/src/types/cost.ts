export interface CostEvent {
  id: string;
  companyId: string;
  agentId: string;
  runId: string | null;
  issueId: string | null;
  projectId: string | null;
  goalId: string | null;
  billingCode: string | null;
  adapterType: string;
  billingType: "api" | "subscription" | "unknown";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  calculatedCostCents?: number | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface CostSummary {
  companyId: string;
  spendCents: number;
  budgetCents: number;
  utilizationPercent: number;
}

export interface CostByProviderModel {
  model: string;
  billingType: "api" | "subscription" | "unknown";
  costCents: number;
  runCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostByProvider {
  provider: string;
  billingType: "api" | "subscription" | "unknown";
  costCents: number;
  runCount: number;
  inputTokens: number;
  outputTokens: number;
  models: CostByProviderModel[];
}

export interface CostWindow {
  key: "5h" | "24h" | "7d" | "30d";
  label: string;
  from: string;
  to: string;
  apiSpendCents: number;
  apiRunCount: number;
  subscriptionRunCount: number;
  unknownRunCount: number;
  totalRunCount: number;
  inputTokens: number;
  outputTokens: number;
  subscriptionInputTokens: number;
  subscriptionOutputTokens: number;
}

export interface CostByAgent {
  agentId: string;
  agentName: string | null;
  agentStatus: string | null;
  agentAdapterType: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  apiRunCount: number;
  subscriptionRunCount: number;
  subscriptionInputTokens: number;
  subscriptionOutputTokens: number;
}

export interface CostByRuntime {
  adapterType: string;
  costCents: number;
  apiCostCents: number;
  apiRunCount: number;
  apiInputTokens: number;
  apiOutputTokens: number;
  subscriptionRunCount: number;
  subscriptionInputTokens: number;
  subscriptionOutputTokens: number;
  unknownRunCount: number;
  unknownInputTokens: number;
  unknownOutputTokens: number;
  totalRunCount: number;
}
