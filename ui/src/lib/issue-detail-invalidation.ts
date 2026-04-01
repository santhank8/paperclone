import { queryKeys } from "./queryKeys";

export function buildIssueDetailCompanyInvalidationKeys(
  issueCompanyId: string | null | undefined,
  selectedCompanyId: string | null | undefined,
) {
  const companyId = issueCompanyId ?? selectedCompanyId ?? null;
  if (!companyId) return [];

  return [
    queryKeys.issues.list(companyId),
    queryKeys.issues.listMineByMe(companyId),
    queryKeys.issues.listTouchedByMe(companyId),
    queryKeys.issues.listUnreadTouchedByMe(companyId),
    queryKeys.sidebarBadges(companyId),
  ] as const;
}
