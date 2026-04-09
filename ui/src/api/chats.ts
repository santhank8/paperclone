import { api } from "./client";

export interface AgentChat {
  id: string;
  companyId: string;
  agentId: string;
  initiatedByUserId: string;
  title: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatMessage {
  id: string;
  companyId: string;
  chatId: string;
  role: "user" | "agent";
  body: string;
  runId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatWithMessages extends AgentChat {
  messages: AgentChatMessage[];
}

export interface SendMessageResult {
  message: AgentChatMessage;
  runId: string | null;
}

function chatBasePath(agentId: string) {
  return `/agents/${encodeURIComponent(agentId)}/chats`;
}

export const chatsApi = {
  list: (agentId: string) => api.get<AgentChat[]>(chatBasePath(agentId)),

  create: (agentId: string) => api.post<AgentChat>(chatBasePath(agentId), {}),

  get: (agentId: string, chatId: string) =>
    api.get<AgentChatWithMessages>(`${chatBasePath(agentId)}/${encodeURIComponent(chatId)}`),

  update: (agentId: string, chatId: string, data: { title?: string; status?: "active" | "archived" }) =>
    api.patch<AgentChat>(`${chatBasePath(agentId)}/${encodeURIComponent(chatId)}`, data),

  getMessages: (agentId: string, chatId: string) =>
    api.get<AgentChatMessage[]>(`${chatBasePath(agentId)}/${encodeURIComponent(chatId)}/messages`),

  sendMessage: (agentId: string, chatId: string, body: string) =>
    api.post<SendMessageResult>(`${chatBasePath(agentId)}/${encodeURIComponent(chatId)}/messages`, { body }),
};
