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

export const issueBoardStatusOrder = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const satisfies readonly IssueStatus[];

const issueCreateStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
] as const satisfies readonly IssueStatus[];

export const issueCreateStatusOptions = issueCreateStatuses.map((value) => ({
  value,
  label: issueStatusLabels[value],
  color: issueStatusText[value] ?? issueStatusTextDefault,
}));

export function issueStatusLabel(status: string): string {
  if (status in issueStatusLabels) {
    return issueStatusLabels[status as IssueStatus];
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
