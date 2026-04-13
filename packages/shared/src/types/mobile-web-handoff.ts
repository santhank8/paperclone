export type MobileWebHandoffTarget = "onboarding";

export interface CreateMobileWebHandoffRequest {
  target: MobileWebHandoffTarget;
  companyId?: string;
  returnUrl?: string;
}

export interface MobileWebHandoffResponse {
  url: string;
  expiresAt: string;
}
