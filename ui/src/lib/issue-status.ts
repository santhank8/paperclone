import {
  ISSUE_STATUSES,
  OBJECTIVE_ISSUE_STATUSES,
  TASK_ISSUE_STATUSES,
  type IssueStatus,
  type IssueType,
} from "@paperclipai/shared";

export const DEFAULT_ISSUE_TYPE: IssueType = "task";

export const ISSUE_STATUS_ORDER: readonly IssueStatus[] = [
  "draft",
  "retrieval_pending",
  "active",
  "qa_review",
  "km_pending",
  "blocked",
  "closed",
  "cancelled",
];

const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  draft: "Draft",
  retrieval_pending: "Retrieval Pending",
  active: "Active",
  qa_review: "QA Review",
  km_pending: "KM Pending",
  blocked: "Blocked",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const CHECKOUT_EXPECTED_STATUSES: readonly IssueStatus[] = [
  "draft",
  "retrieval_pending",
  "blocked",
];

export const CLOSED_ISSUE_STATUSES = new Set<IssueStatus>(["closed", "cancelled"]);

export function issueStatusLabel(status: string): string {
  if ((ISSUE_STATUSES as readonly string[]).includes(status)) {
    return ISSUE_STATUS_LABELS[status as IssueStatus];
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getIssueStatusesForType(issueType?: IssueType | null): readonly IssueStatus[] {
  if (issueType === "objective") return OBJECTIVE_ISSUE_STATUSES;
  if (issueType === "task") return TASK_ISSUE_STATUSES;
  return ISSUE_STATUS_ORDER;
}

export function isIssueStatusValidForType(issueType: IssueType, status: string): status is IssueStatus {
  return (getIssueStatusesForType(issueType) as readonly string[]).includes(status);
}

export function inferIssueTypeForStatus(status: string | null | undefined): IssueType {
  if (typeof status !== "string" || status.length === 0) return DEFAULT_ISSUE_TYPE;
  if (
    (OBJECTIVE_ISSUE_STATUSES as readonly string[]).includes(status) &&
    !(TASK_ISSUE_STATUSES as readonly string[]).includes(status)
  ) {
    return "objective";
  }
  return DEFAULT_ISSUE_TYPE;
}

export function normalizeIssueStatusForType(issueType: IssueType, status?: string | null): IssueStatus {
  if (status && isIssueStatusValidForType(issueType, status)) return status;
  return "draft";
}