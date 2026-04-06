import type {
  CreateVirtualOrgInboxItemInput,
  OfficelyInternalDatabaseSetupInput,
  OfficelyInternalDatabaseSetupResult,
  OfficelyInternalDatabaseTestResult,
  OfficelyPostHogSetupInput,
  OfficelyPostHogSetupResult,
  OfficelyPostHogTestResult,
  OfficelySlackSetupInput,
  OfficelySlackSetupResult,
  OfficelySlackTestResult,
  OfficelyStripeSetupInput,
  OfficelyStripeSetupResult,
  OfficelyStripeTestResult,
  OfficelyXeroSetupInput,
  OfficelyXeroSetupResult,
  OfficelyXeroTestResult,
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
        xeroCashReceipts: number;
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
  saveOfficelyXeroSetup: (companyId: string, data: OfficelyXeroSetupInput) =>
    api.post<OfficelyXeroSetupResult>(
      `/virtual-org/companies/${companyId}/officely/xero/setup`,
      data,
    ),
  testOfficelyXeroSetup: (companyId: string, data: OfficelyXeroSetupInput) =>
    api.post<OfficelyXeroTestResult>(
      `/virtual-org/companies/${companyId}/officely/xero/test`,
      data,
    ),
  saveOfficelySlackSetup: (companyId: string, data: OfficelySlackSetupInput) =>
    api.post<OfficelySlackSetupResult>(
      `/virtual-org/companies/${companyId}/officely/slack/setup`,
      data,
    ),
  testOfficelySlackSetup: (companyId: string, data: OfficelySlackSetupInput) =>
    api.post<OfficelySlackTestResult>(
      `/virtual-org/companies/${companyId}/officely/slack/test`,
      data,
    ),
  saveOfficelyStripeSetup: (companyId: string, data: OfficelyStripeSetupInput) =>
    api.post<OfficelyStripeSetupResult>(
      `/virtual-org/companies/${companyId}/officely/stripe/setup`,
      data,
    ),
  testOfficelyStripeSetup: (companyId: string, data: OfficelyStripeSetupInput) =>
    api.post<OfficelyStripeTestResult>(
      `/virtual-org/companies/${companyId}/officely/stripe/test`,
      data,
    ),
  saveOfficelyPostHogSetup: (companyId: string, data: OfficelyPostHogSetupInput) =>
    api.post<OfficelyPostHogSetupResult>(
      `/virtual-org/companies/${companyId}/officely/posthog/setup`,
      data,
    ),
  testOfficelyPostHogSetup: (companyId: string, data: OfficelyPostHogSetupInput) =>
    api.post<OfficelyPostHogTestResult>(
      `/virtual-org/companies/${companyId}/officely/posthog/test`,
      data,
    ),
  createInboxItem: (data: CreateVirtualOrgInboxItemInput) => api.post<VirtualOrgInboxItem>("/virtual-org/inbox", data),
  clarifyInboxItem: (itemId: string, data: { companyId: string; clarificationReply: string }) =>
    api.post<VirtualOrgInboxItem>(`/virtual-org/inbox/${itemId}/clarify`, data),
};
