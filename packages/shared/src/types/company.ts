import type { CompanyStatus } from "../constants.js";
import type { OfficeConfig } from "./office.js";

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
  brandColor: string | null;
  officeConfig: OfficeConfig | null;
  createdAt: Date;
  updatedAt: Date;
}
