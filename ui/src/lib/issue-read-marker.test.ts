import type { Issue } from "@paperclipai/shared";
import { describe, expect, it } from "vitest";
import { buildIssueReadMarker, shouldMarkIssueRead } from "./issue-read-marker";

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "PAP-22",
    companyId: "company-1",
    projectId: null,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: "Issue",
    description: null,
    status: "todo",
    priority: "medium",
    assigneeAgentId: null,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: 22,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    labels: [],
    labelIds: [],
    myLastTouchAt: null,
    lastExternalCommentAt: null,
    isUnreadForMe: false,
    ...overrides,
  };
}

describe("issue read marker", () => {
  it("does not request mark-read for already-read issues", () => {
    const issue = createIssue({ isUnreadForMe: false });

    expect(buildIssueReadMarker(issue)).toBeNull();
    expect(shouldMarkIssueRead(issue, null)).toBe(false);
  });

  it("marks an unread issue the first time it is opened", () => {
    const issue = createIssue({
      isUnreadForMe: true,
      lastExternalCommentAt: new Date("2026-04-01T01:00:00.000Z"),
    });

    expect(shouldMarkIssueRead(issue, null)).toBe(true);
  });

  it("does not mark read again for the same unread marker", () => {
    const issue = createIssue({
      isUnreadForMe: true,
      lastExternalCommentAt: new Date("2026-04-01T01:00:00.000Z"),
    });

    const marker = buildIssueReadMarker(issue);
    expect(marker).not.toBeNull();
    expect(shouldMarkIssueRead(issue, marker)).toBe(false);
  });

  it("marks read again when the same issue gets a newer external comment", () => {
    const original = createIssue({
      isUnreadForMe: true,
      lastExternalCommentAt: new Date("2026-04-01T01:00:00.000Z"),
    });
    const next = createIssue({
      isUnreadForMe: true,
      lastExternalCommentAt: new Date("2026-04-01T02:00:00.000Z"),
    });

    const marker = buildIssueReadMarker(original);
    expect(marker).not.toBeNull();
    expect(shouldMarkIssueRead(next, marker)).toBe(true);
  });

  it("falls back to updatedAt when there is no external comment timestamp yet", () => {
    const issue = createIssue({
      isUnreadForMe: true,
      lastExternalCommentAt: null,
      updatedAt: new Date("2026-04-01T03:00:00.000Z"),
    });

    expect(buildIssueReadMarker(issue)).toContain("2026-04-01T03:00:00.000Z");
  });
});
