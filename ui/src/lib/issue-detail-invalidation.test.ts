import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";
import { buildIssueDetailCompanyInvalidationKeys } from "./issue-detail-invalidation";

describe("issue detail invalidation keys", () => {
  it("uses the issue company id when the selected company is not ready", () => {
    expect(
      buildIssueDetailCompanyInvalidationKeys("company-from-issue", null),
    ).toEqual([
      queryKeys.issues.list("company-from-issue"),
      queryKeys.issues.listMineByMe("company-from-issue"),
      queryKeys.issues.listTouchedByMe("company-from-issue"),
      queryKeys.issues.listUnreadTouchedByMe("company-from-issue"),
      queryKeys.sidebarBadges("company-from-issue"),
    ]);
  });

  it("falls back to the selected company id when the issue company is missing", () => {
    expect(
      buildIssueDetailCompanyInvalidationKeys(null, "company-selected"),
    ).toEqual([
      queryKeys.issues.list("company-selected"),
      queryKeys.issues.listMineByMe("company-selected"),
      queryKeys.issues.listTouchedByMe("company-selected"),
      queryKeys.issues.listUnreadTouchedByMe("company-selected"),
      queryKeys.sidebarBadges("company-selected"),
    ]);
  });

  it("returns no invalidation keys when neither company id exists", () => {
    expect(buildIssueDetailCompanyInvalidationKeys(null, null)).toEqual([]);
  });
});
