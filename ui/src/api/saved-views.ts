import { api } from "./client";

export interface SavedView {
  id: string;
  companyId: string;
  name: string;
  filters: {
    statuses: string[];
    priorities: string[];
    assignees: string[];
    labels: string[];
  };
  groupBy: string;
  sortField: string;
  sortDirection: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateSavedViewInput = {
  name: string;
  filters: SavedView["filters"];
  groupBy: string;
  sortField: string;
  sortDirection: string;
};

export type UpdateSavedViewInput = Partial<CreateSavedViewInput>;

export const savedViewsApi = {
  list: (companyId: string) =>
    api.get<SavedView[]>(`/companies/${companyId}/saved-views`),
  create: (companyId: string, data: CreateSavedViewInput) =>
    api.post<SavedView>(`/companies/${companyId}/saved-views`, data),
  update: (companyId: string, viewId: string, data: UpdateSavedViewInput) =>
    api.patch<SavedView>(`/companies/${companyId}/saved-views/${viewId}`, data),
  remove: (companyId: string, viewId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/saved-views/${viewId}`),
};
