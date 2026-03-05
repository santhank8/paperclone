import type { ChatConversationKind, ChatDeliveryStatus, PrincipalType } from "../constants.js";

export interface ChatConversationParticipant {
  id: string;
  companyId: string;
  conversationId: string;
  principalType: PrincipalType;
  principalId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatReactionAggregate {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface ChatMessageDelivery {
  status: ChatDeliveryStatus;
  targetAgentId: string;
  attemptCount: number;
  timeoutAt: Date;
  lastError: string | null;
  resolvedByMessageId: string | null;
}

export interface ChatMessage {
  id: string;
  companyId: string;
  conversationId: string;
  threadRootMessageId: string | null;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  deletedByAgentId: string | null;
  replyCount?: number;
  reactions?: ChatReactionAggregate[];
  delivery?: ChatMessageDelivery | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatDeliveryExpectation {
  id: string;
  companyId: string;
  conversationId: string;
  sourceMessageId: string;
  targetAgentId: string;
  status: ChatDeliveryStatus;
  attemptCount: number;
  timeoutAt: Date;
  nextCheckAt: Date;
  resolvedByMessageId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatReadState {
  id: string;
  companyId: string;
  conversationId: string;
  principalType: PrincipalType;
  principalId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConversation {
  id: string;
  companyId: string;
  kind: ChatConversationKind;
  name: string;
  slug: string | null;
  dmParticipantKey: string | null;
  archivedAt: Date | null;
  lastMessageAt: Date | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  participants?: ChatConversationParticipant[];
  unreadCount?: number;
  lastMessage?: ChatMessage | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSearchResult {
  conversationId: string;
  messageId: string;
  threadRootMessageId: string | null;
  conversationKind: ChatConversationKind;
  conversationName: string;
  snippet: string;
  rank: number;
  createdAt: Date;
}
