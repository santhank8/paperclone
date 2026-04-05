import { api } from "./client";

export interface Channel {
  id: string;
  companyId: string;
  scopeType: "company" | "department" | "project";
  scopeId: string | null;
  name: string;
  createdAt: string;
  unreadCount?: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  messageType: string;
  mentions: Array<{ type: string; id: string }>;
  linkedIssueId: string | null;
  replyToId: string | null;
  createdAt: string;
}

export const channelsApi = {
  list: (companyId: string) =>
    api.get<Channel[]>(`/companies/${companyId}/channels`),
  messages: (companyId: string, channelId: string, limit = 50) =>
    api.get<ChannelMessage[]>(
      `/companies/${companyId}/channels/${channelId}/messages?limit=${limit}`,
    ),
  postMessage: (
    companyId: string,
    channelId: string,
    body: { body: string; messageType?: string },
  ) =>
    api.post<ChannelMessage>(
      `/companies/${companyId}/channels/${channelId}/messages`,
      body,
    ),
};
