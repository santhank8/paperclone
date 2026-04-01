type OnboardingRouteCompany = {
  id: string;
  issuePrefix: string;
};

export function isOnboardingPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1) {
    return segments[0]?.toLowerCase() === "onboarding";
  }

  if (segments.length === 2) {
    return segments[1]?.toLowerCase() === "onboarding";
  }

  return false;
}

export function resolveRouteOnboardingOptions(params: {
  pathname: string;
  companyPrefix?: string;
  companies: OnboardingRouteCompany[];
  canCreateCompany?: boolean;
}): { initialStep: 1 | 2; companyId?: string } | null {
  const { pathname, companyPrefix, companies, canCreateCompany = true } = params;

  if (!isOnboardingPath(pathname)) return null;

  if (!companyPrefix) {
    if (!canCreateCompany) return null;
    return { initialStep: 1 };
  }

  const matchedCompany =
    companies.find(
      (company) =>
        company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase(),
    ) ?? null;

  if (!matchedCompany) {
    if (!canCreateCompany) return null;
    return { initialStep: 1 };
  }

  return { initialStep: 2, companyId: matchedCompany.id };
}

export function shouldRedirectCompanylessRouteToOnboarding(params: {
  pathname: string;
  hasCompanies: boolean;
  canCreateCompany?: boolean;
}): boolean {
  return !params.hasCompanies && (params.canCreateCompany ?? true) && !isOnboardingPath(params.pathname);
}
