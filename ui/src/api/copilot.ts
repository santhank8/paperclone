import type {
  CopilotMessageCreateResponse,
  CopilotRouteContext,
  CopilotThreadSummary,
} from "@paperclipai/shared";
import { api } from "./client";

export const copilotApi = {
  getThread: (companyId: string, input?: { contextIssueId?: string | null }) => {
    const params = new URLSearchParams();
    if (input?.contextIssueId) {
      params.set("contextIssueId", input.contextIssueId);
    }
    const qs = params.toString();
    return api.get<CopilotThreadSummary>(
      `/companies/${companyId}/copilot/thread${qs ? `?${qs}` : ""}`,
    );
  },
  createThread: (companyId: string, input?: { contextIssueId?: string | null }) =>
    api.post<CopilotThreadSummary>(`/companies/${companyId}/copilot/thread/new`, {
      contextIssueId: input?.contextIssueId ?? null,
    }),
  sendMessage: (companyId: string, data: { body: string; context?: CopilotRouteContext }) =>
    api.post<CopilotMessageCreateResponse>(`/companies/${companyId}/copilot/thread/messages`, data),
};
