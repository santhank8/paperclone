import type { ChatMessage, CreateChatMessageResponse } from "@paperclipai/shared";
import { api } from "./client";

function basePath(agentId: string) {
  return `/agents/${encodeURIComponent(agentId)}/chat/messages`;
}

export interface ChatLogEvent {
  ts: string;
  stream: "stdout" | "stderr" | "system";
  chunk: string;
}

export const chatApi = {
  list: (agentId: string) => api.get<ChatMessage[]>(basePath(agentId)),
  send: (agentId: string, body: { content: string }) =>
    api.post<CreateChatMessageResponse>(basePath(agentId), body),
  streamUrl: (agentId: string, messageId: string) =>
    `/api${basePath(agentId)}/${encodeURIComponent(messageId)}/stream`,
};
