import type { InboxDismissalKind } from "../constants.js";
import type { SidebarBadges } from "./sidebar-badges.js";

export interface InboxDismissal {
  kind: InboxDismissalKind;
  targetId: string;
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxDismissalsResponse {
  failedRunIds: string[];
  staleIssueIds: string[];
  alerts: {
    agentErrors: boolean;
    budget: boolean;
  };
  items: InboxDismissal[];
}

export type CreateInboxDismissalRequest =
  | { kind: "failed_run"; runId: string }
  | { kind: "stale_issue"; issueId: string }
  | { kind: "agent_errors_alert" }
  | { kind: "budget_alert" };

export interface InboxStateResponse {
  dismissals: InboxDismissalsResponse;
  sidebarBadges: SidebarBadges;
}
