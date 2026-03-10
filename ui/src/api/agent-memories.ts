import type { AgentMemory } from "@paperclipai/shared";
import { api } from "./client";

export const agentMemoriesApi = {
  list: (agentId: string, category?: string) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return api.get<AgentMemory[]>(`/agents/${agentId}/memories${params}`);
  },
  listForCompany: (companyId: string) =>
    api.get<AgentMemory[]>(`/companies/${companyId}/memories`),
  get: (memoryId: string) => api.get<AgentMemory>(`/memories/${memoryId}`),
  create: (agentId: string, data: Record<string, unknown>) =>
    api.post<AgentMemory>(`/agents/${agentId}/memories`, data),
  update: (memoryId: string, data: Record<string, unknown>) =>
    api.patch<AgentMemory>(`/memories/${memoryId}`, data),
  remove: (memoryId: string) => api.delete<AgentMemory>(`/memories/${memoryId}`),
};
