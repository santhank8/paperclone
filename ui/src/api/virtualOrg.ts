import type {
  CreateVirtualOrgInboxItemInput,
  OfficelyInternalDatabaseSetupInput,
  OfficelyInternalDatabaseSetupResult,
  OfficelyInternalDatabaseTestResult,
  VirtualOrgInboxItem,
  VirtualOrgPortfolioSummary,
  VirtualOrgWorkspaceSummary,
} from "@paperclipai/virtual-org-types";
import { api } from "./client";

export const virtualOrgApi = {
  portfolio: () => api.get<VirtualOrgPortfolioSummary>("/virtual-org/portfolio"),
  bootstrapDefaults: () => api.post<Array<{ companyId: string; name: string }>>("/virtual-org/bootstrap-defaults", {}),
  workspace: (companyId: string) => api.get<VirtualOrgWorkspaceSummary>(`/virtual-org/companies/${companyId}/workspace`),
  syncOfficelyV1: (companyId: string) =>
    api.post<{
      companyId: string;
      profileCount: number;
      insightCount: number;
      counts: {
        internalAccounts: number;
        xeroInvoices: number;
        stripeEvents: number;
        posthogAccounts: number;
      };
    }>(`/virtual-org/companies/${companyId}/officely/sync-v1`, {}),
  saveOfficelyInternalDatabaseSetup: (companyId: string, data: OfficelyInternalDatabaseSetupInput) =>
    api.post<OfficelyInternalDatabaseSetupResult>(
      `/virtual-org/companies/${companyId}/officely/internal-database/setup`,
      data,
    ),
  testOfficelyInternalDatabaseSetup: (companyId: string, data: OfficelyInternalDatabaseSetupInput) =>
    api.post<OfficelyInternalDatabaseTestResult>(
      `/virtual-org/companies/${companyId}/officely/internal-database/test`,
      data,
    ),
  createInboxItem: (data: CreateVirtualOrgInboxItemInput) => api.post<VirtualOrgInboxItem>("/virtual-org/inbox", data),
  clarifyInboxItem: (itemId: string, data: { companyId: string; clarificationReply: string }) =>
    api.post<VirtualOrgInboxItem>(`/virtual-org/inbox/${itemId}/clarify`, data),
};
