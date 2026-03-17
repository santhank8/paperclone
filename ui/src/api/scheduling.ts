import type { UnifiedScheduledJob, RunHistoryEntry } from "@paperclipai/shared";
import { api } from "./client";

export const schedulingApi = {
  listJobs: (companyId: string) =>
    api.get<{ jobs: UnifiedScheduledJob[] }>(`/companies/${companyId}/scheduling/jobs`),
  getHistory: (companyId: string, jobId: string, page = 0) =>
    api.get<{ entries: RunHistoryEntry[]; total: number; hasMore: boolean }>(
      `/companies/${companyId}/scheduling/history?jobId=${jobId}&page=${page}`,
    ),
  toggleJob: (companyId: string, jobId: string, enabled: boolean) =>
    api.post<{ ok: boolean; enabled: boolean }>(
      `/companies/${companyId}/scheduling/toggle`,
      { jobId, enabled },
    ),
};
