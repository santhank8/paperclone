import type { AgentRole, CompanyStatus } from "../constants.js";

export type CompanyHeartbeatIntervalsByRole = Partial<Record<AgentRole, number>>;

export interface CompanyRuntimePolicy {
  heartbeat?: {
    intervalsByRole?: CompanyHeartbeatIntervalsByRole;
  };
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  requireBoardApprovalForNewAgents: boolean;
  runtimePolicy: CompanyRuntimePolicy;
  brandColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}
