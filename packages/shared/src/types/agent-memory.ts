export interface AgentMemory {
  id: string;
  companyId: string;
  agentId: string;
  category: string;
  key: string;
  content: string;
  importance: number;
  sourceRunId: string | null;
  sourceIssueId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
