import type { CostSummary, CostByAgent, CostByProvider, CostByRuntime, CostWindow } from "@paperclipai/shared";
import { api } from "./client";

export interface CostByProject {
  projectId: string | null;
  projectName: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

function dateParams(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const costsApi = {
  summary: (companyId: string, from?: string, to?: string) =>
    api.get<CostSummary>(`/companies/${companyId}/costs/summary${dateParams(from, to)}`),
  byAgent: (companyId: string, from?: string, to?: string) =>
    api.get<CostByAgent[]>(`/companies/${companyId}/costs/by-agent${dateParams(from, to)}`),
  byRuntime: (companyId: string, from?: string, to?: string) =>
    api.get<CostByRuntime[]>(`/companies/${companyId}/costs/by-runtime${dateParams(from, to)}`),
  byProvider: (companyId: string, from?: string, to?: string) =>
    api.get<CostByProvider[]>(`/companies/${companyId}/costs/by-provider${dateParams(from, to)}`),
  windows: (companyId: string) =>
    api.get<CostWindow[]>(`/companies/${companyId}/costs/windows`),
  byProject: (companyId: string, from?: string, to?: string) =>
    api.get<CostByProject[]>(`/companies/${companyId}/costs/by-project${dateParams(from, to)}`),
};
