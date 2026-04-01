import type { Issue } from "@paperclipai/shared";

type IssueReadMarkerSource = Pick<Issue, "id" | "isUnreadForMe" | "lastExternalCommentAt" | "updatedAt">;

function toMarkerTimestamp(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

export function buildIssueReadMarker(issue: IssueReadMarkerSource): string | null {
  if (!issue.isUnreadForMe) return null;
  const timestamp = toMarkerTimestamp(issue.lastExternalCommentAt) ?? toMarkerTimestamp(issue.updatedAt);
  return timestamp ? `${issue.id}:${timestamp}` : issue.id;
}

export function shouldMarkIssueRead(issue: IssueReadMarkerSource, lastReadMarker: string | null): boolean {
  const marker = buildIssueReadMarker(issue);
  return marker !== null && marker !== lastReadMarker;
}
