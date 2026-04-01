import type { ChatRoom, ChatMessage } from "@paperclipai/shared";
import { api } from "./client";

export const chatApi = {
  listRooms: (companyId: string) =>
    api.get<ChatRoom[]>(`/companies/${encodeURIComponent(companyId)}/chat/rooms`),

  getOrCreateRoom: (companyId: string, data: { kind: "direct" | "boardroom"; agentId?: string }) =>
    api.post<ChatRoom>(`/companies/${encodeURIComponent(companyId)}/chat/rooms`, data),

  listMessages: (companyId: string, roomId: string, opts?: { before?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.before) params.set("before", opts.before);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<ChatMessage[]>(
      `/companies/${encodeURIComponent(companyId)}/chat/rooms/${encodeURIComponent(roomId)}/messages${qs ? `?${qs}` : ""}`,
    );
  },

  postMessage: (companyId: string, roomId: string, data: { body: string }) =>
    api.post<ChatMessage>(
      `/companies/${encodeURIComponent(companyId)}/chat/rooms/${encodeURIComponent(roomId)}/messages`,
      data,
    ),
};
