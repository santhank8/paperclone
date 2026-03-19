import type { CompanyDocumentListItem } from "@paperclipai/shared";
import { api } from "./client";

export const docsApi = {
  list: (companyId: string) =>
    api.get<CompanyDocumentListItem[]>(`/companies/${companyId}/documents`),
};
