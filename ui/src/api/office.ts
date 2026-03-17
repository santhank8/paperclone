import type { OfficeConfig } from "@paperclipai/shared";
import { api } from "./client";

export const officeApi = {
  getConfig: (companyId: string) =>
    api.get<OfficeConfig>(`/companies/${companyId}/office-config`),
  updateConfig: (companyId: string, config: OfficeConfig) =>
    api.patch<OfficeConfig>(`/companies/${companyId}/office-config`, config),
};
