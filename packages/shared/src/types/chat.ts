export type ChatMessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  companyId: string;
  agentId: string;
  role: ChatMessageRole;
  content: string;
  runId: string | null;
  createdAt: Date;
}

export interface CreateChatMessageResponse {
  message: ChatMessage;
  runId: string | null;
}
