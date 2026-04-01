import { describe, expect, it } from "vitest";
import {
  hasIssueDetailDeepLink,
  isIssueDetailNearBottom,
  shouldAutoScrollIssueDetailOnOpen,
  shouldContinueFollowingIssueDetail,
} from "./issue-detail-scroll";

describe("issue detail scroll follow helpers", () => {
  it("auto-scrolls on first open when there is timeline activity and no deep link", () => {
    expect(
      shouldAutoScrollIssueDetailOnOpen({
        hash: "",
        activityCount: 3,
      }),
    ).toBe(true);
  });

  it("skips initial auto-scroll when opening a specific comment or document anchor", () => {
    expect(
      shouldAutoScrollIssueDetailOnOpen({
        hash: "#comment-comment-1",
        activityCount: 3,
      }),
    ).toBe(false);

    expect(
      shouldAutoScrollIssueDetailOnOpen({
        hash: "#document-plan",
        activityCount: 3,
      }),
    ).toBe(false);
  });

  it("detects deep links only for supported issue detail anchors", () => {
    expect(hasIssueDetailDeepLink("#comment-123")).toBe(true);
    expect(hasIssueDetailDeepLink("#document-plan")).toBe(true);
    expect(hasIssueDetailDeepLink("#activity")).toBe(false);
    expect(hasIssueDetailDeepLink("")).toBe(false);
  });

  it("treats short bottom distance as still following", () => {
    expect(isIssueDetailNearBottom(12)).toBe(true);
    expect(isIssueDetailNearBottom(48)).toBe(false);
  });

  it("keeps following when growth happens and the reader stays pinned to bottom", () => {
    expect(
      shouldContinueFollowingIssueDetail({
        previousScrollHeight: 1000,
        previousDistanceFromBottom: 0,
        currentScrollHeight: 1200,
        currentDistanceFromBottom: 0,
      }),
    ).toBe(true);
  });

  it("releases follow when the reader moves away from bottom during growth", () => {
    expect(
      shouldContinueFollowingIssueDetail({
        previousScrollHeight: 1000,
        previousDistanceFromBottom: 0,
        currentScrollHeight: 1200,
        currentDistanceFromBottom: 260,
      }),
    ).toBe(false);
  });
});
