import type {
  KnowledgeEntry,
  KnowledgeEntryWithContent,
  KnowledgeDepartment,
  KnowledgeDocumentRevision,
  KnowledgeEntryScope,
} from "@paperclipai/shared";
import { api } from "./client";

function enc(s: string) {
  return encodeURIComponent(s);
}

export const knowledgeApi = {
  list: (companyId: string, params?: { scope?: KnowledgeEntryScope; scopeAgentId?: string; parentId?: string | null }) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.scopeAgentId) qs.set("scopeAgentId", params.scopeAgentId);
    if (params?.parentId !== undefined) qs.set("parentId", params.parentId ?? "null");
    const query = qs.toString();
    return api.get<KnowledgeEntry[]>(`/companies/${enc(companyId)}/knowledge${query ? `?${query}` : ""}`);
  },

  departments: (companyId: string) =>
    api.get<KnowledgeDepartment[]>(`/companies/${enc(companyId)}/knowledge/departments`),

  tree: (companyId: string, params?: { scope?: KnowledgeEntryScope; scopeAgentId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.scopeAgentId) qs.set("scopeAgentId", params.scopeAgentId);
    const query = qs.toString();
    return api.get<KnowledgeEntry[]>(`/companies/${enc(companyId)}/knowledge/tree${query ? `?${query}` : ""}`);
  },

  detail: (companyId: string, entryId: string) =>
    api.get<KnowledgeEntryWithContent>(`/companies/${enc(companyId)}/knowledge/${enc(entryId)}`),

  createFolder: (companyId: string, data: {
    name: string;
    scope: KnowledgeEntryScope;
    scopeAgentId?: string | null;
    parentId?: string | null;
    description?: string | null;
  }) =>
    api.post<KnowledgeEntry>(`/companies/${enc(companyId)}/knowledge`, {
      type: "folder",
      ...data,
    }),

  createDocument: (companyId: string, data: {
    name: string;
    scope: KnowledgeEntryScope;
    scopeAgentId?: string | null;
    parentId?: string | null;
    description?: string | null;
    body: string;
  }) =>
    api.post<KnowledgeEntryWithContent>(`/companies/${enc(companyId)}/knowledge`, {
      type: "document",
      ...data,
    }),

  uploadFile: (companyId: string, formData: FormData) =>
    api.postForm<KnowledgeEntryWithContent>(`/companies/${enc(companyId)}/knowledge/upload`, formData),

  update: (companyId: string, entryId: string, data: {
    name?: string;
    parentId?: string | null;
    description?: string | null;
    sortOrder?: number;
  }) =>
    api.patch<KnowledgeEntry>(`/companies/${enc(companyId)}/knowledge/${enc(entryId)}`, data),

  updateBody: (companyId: string, entryId: string, data: {
    body: string;
    baseRevisionId?: string | null;
    changeSummary?: string | null;
  }) =>
    api.put<KnowledgeEntryWithContent>(`/companies/${enc(companyId)}/knowledge/${enc(entryId)}/body`, data),

  revisions: (companyId: string, entryId: string) =>
    api.get<KnowledgeDocumentRevision[]>(`/companies/${enc(companyId)}/knowledge/${enc(entryId)}/revisions`),

  delete: (companyId: string, entryId: string) =>
    api.delete<KnowledgeEntry>(`/companies/${enc(companyId)}/knowledge/${enc(entryId)}`),

  agentView: (companyId: string, agentId: string) =>
    api.get<KnowledgeEntry[]>(`/companies/${enc(companyId)}/knowledge/agent/${enc(agentId)}`),
};
