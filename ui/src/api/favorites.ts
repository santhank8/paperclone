import type { Issue } from "@paperclipai/shared";
import { api } from "./client";

export const favoritesApi = {
  list: (companyId: string) =>
    api.get<Issue[]>(`/companies/${companyId}/favorites`),
  add: (issueId: string) =>
    api.putNoContent(`/issues/${issueId}/favorite`),
  remove: (issueId: string) =>
    api.deleteNoContent(`/issues/${issueId}/favorite`),
};
