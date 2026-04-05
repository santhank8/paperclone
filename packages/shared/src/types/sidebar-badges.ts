export interface SidebarBadges {
  inbox: number;
  approvals: number;
  failedRuns: number;
  joinRequests: number;
  /** Count of deliverables in 'review' status pending human approval. */
  deliverablesReview: number;
}
