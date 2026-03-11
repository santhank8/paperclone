import type { CreateInboxDismissalRequest, InboxDismissalsResponse } from "@paperclipai/shared";
import { api } from "./client";

export const inboxDismissalsApi = {
  get: (companyId: string) => api.get<InboxDismissalsResponse>(`/companies/${companyId}/inbox-dismissals`),
  create: (companyId: string, body: CreateInboxDismissalRequest) =>
    api.post<unknown>(`/companies/${companyId}/inbox-dismissals`, body),
  clear: (companyId: string) => api.delete<{ ok: true; count: number }>(`/companies/${companyId}/inbox-dismissals`),
};
