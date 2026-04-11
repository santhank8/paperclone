import { type IssueStatus } from "@paperclipai/shared";
import { issueStatusText, issueStatusTextDefault } from "./status-colors";

const issueStatusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const issueBoardStatusOrder: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export const issueFilterStatusOrder: IssueStatus[] = [
  "in_progress",
  "todo",
  "backlog",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export const issueChartStatusOrder: IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
  "backlog",
];

const issueCreateStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const satisfies readonly IssueStatus[];

export const issueCreateStatusOptions = issueCreateStatuses.map((value) => ({
  value,
  label: issueStatusLabels[value],
  color: issueStatusText[value] ?? issueStatusTextDefault,
}));

export const issueStatusChartColors: Record<IssueStatus, string> = {
  backlog: "#64748b",
  todo: "#2563eb",
  in_progress: "#ca8a04",
  in_review: "#7c3aed",
  blocked: "#dc2626",
  done: "#16a34a",
  cancelled: "#737373",
};

export const issueStatusChartColorDefault = "#6b7280";

export function issueStatusLabel(status: string): string {
  if (status in issueStatusLabels) {
    return issueStatusLabels[status as IssueStatus];
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
