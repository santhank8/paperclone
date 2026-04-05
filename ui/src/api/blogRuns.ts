import { api } from "./client";

export interface BlogRunListItem {
  id: string;
  companyId: string;
  projectId: string | null;
  issueId: string | null;
  topic: string;
  lane: string;
  targetSite: string;
  status: string;
  currentStep: string | null;
  approval: {
    mode: string;
    state: string;
    approvalKeyHash: string | null;
  };
  publish: {
    mode: string;
    state: string;
    wordpressPostId: number | null;
    publishIdempotencyKey: string | null;
  };
  publicVerify: {
    state: string;
  };
  latestAttempt: {
    stepKey: string;
    status: string;
    attemptNumber: number;
    errorCode: string | null;
    errorMessage: string | null;
    finishedAt: string | null;
    updatedAt: string;
  } | null;
  latestApproval: {
    targetSlug: string;
    siteId: string;
    approvedAt: string;
    revokedAt: string | null;
  } | null;
  publishedUrl: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const blogRunsApi = {
  listForCompany: (companyId: string, options?: { limit?: number; mode?: "active" | "all" }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.mode) params.set("mode", options.mode);
    const qs = params.toString();
    return api.get<BlogRunListItem[]>(`/companies/${companyId}/blog-runs${qs ? `?${qs}` : ""}`);
  },
};
