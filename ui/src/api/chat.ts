import type {
  ChatConversation,
  ChatMessage,
  ChatReactionAggregate,
  ChatReadState,
  ChatSearchResult,
} from "@paperclipai/shared";
import { api } from "./client";

export const chatApi = {
  listConversations: (companyId: string, opts?: { includeArchived?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.includeArchived) params.set("includeArchived", "true");
    const qs = params.toString();
    return api.get<ChatConversation[]>(`/companies/${companyId}/chat/conversations${qs ? `?${qs}` : ""}`);
  },

  createChannel: (companyId: string, data: { name: string; slug?: string | null }) =>
    api.post<ChatConversation>(`/companies/${companyId}/chat/channels`, data),

  updateConversation: (conversationId: string, data: { name?: string; archived?: boolean }) =>
    api.patch<ChatConversation>(`/chat/conversations/${conversationId}`, data),

  openDm: (companyId: string, data: { participantAgentId?: string | null; participantUserId?: string | null }) =>
    api.post<ChatConversation>(`/companies/${companyId}/chat/dms`, data),

  listMessages: (
    conversationId: string,
    opts?: {
      threadRootMessageId?: string | null;
      before?: string;
      after?: string;
      limit?: number;
    },
  ) => {
    const params = new URLSearchParams();
    if (opts?.threadRootMessageId) params.set("threadRootMessageId", opts.threadRootMessageId);
    if (opts?.before) params.set("before", opts.before);
    if (opts?.after) params.set("after", opts.after);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`);
  },

  createMessage: (
    conversationId: string,
    data: { body: string; threadRootMessageId?: string | null; mentionAgentIds?: string[] },
  ) => api.post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, data),

  deleteMessage: (messageId: string) => api.delete<ChatMessage>(`/chat/messages/${messageId}`),

  addReaction: (messageId: string, emoji: string) =>
    api.post<ChatReactionAggregate[]>(`/chat/messages/${messageId}/reactions`, { emoji }),

  removeReaction: (messageId: string, emoji: string) =>
    api.delete<{ ok: true; reactions: ChatReactionAggregate[] }>(
      `/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    ),

  markRead: (conversationId: string, data?: { lastReadMessageId?: string | null }) =>
    api.post<ChatReadState>(`/chat/conversations/${conversationId}/read`, data ?? {}),

  search: (companyId: string, query: { q: string; limit?: number; conversationId?: string | null }) => {
    const params = new URLSearchParams();
    params.set("q", query.q);
    if (query.limit != null) params.set("limit", String(query.limit));
    if (query.conversationId) params.set("conversationId", query.conversationId);
    return api.get<ChatSearchResult[]>(`/companies/${companyId}/chat/search?${params.toString()}`);
  },
};
