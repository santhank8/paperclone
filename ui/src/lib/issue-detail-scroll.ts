export const ISSUE_DETAIL_FOLLOW_TOLERANCE_PX = 32;

const COMMENT_HASH_PREFIX = "#comment-";
const DOCUMENT_HASH_PREFIX = "#document-";

export function hasIssueDetailDeepLink(hash: string): boolean {
  const normalized = hash.trim();
  return normalized.startsWith(COMMENT_HASH_PREFIX) || normalized.startsWith(DOCUMENT_HASH_PREFIX);
}

export function shouldAutoScrollIssueDetailOnOpen({
  hash,
  activityCount,
}: {
  hash: string;
  activityCount: number;
}): boolean {
  return activityCount > 0 && !hasIssueDetailDeepLink(hash);
}

export function isIssueDetailNearBottom(
  distanceFromBottom: number,
  tolerance = ISSUE_DETAIL_FOLLOW_TOLERANCE_PX,
): boolean {
  return distanceFromBottom <= tolerance;
}

export function shouldContinueFollowingIssueDetail({
  previousScrollHeight,
  previousDistanceFromBottom,
  currentScrollHeight,
  currentDistanceFromBottom,
  tolerance = ISSUE_DETAIL_FOLLOW_TOLERANCE_PX,
}: {
  previousScrollHeight: number;
  previousDistanceFromBottom: number;
  currentScrollHeight: number;
  currentDistanceFromBottom: number;
  tolerance?: number;
}): boolean {
  const growth = Math.max(0, currentScrollHeight - previousScrollHeight);
  const expectedDistance = previousDistanceFromBottom + growth;
  const movedAwayBy = currentDistanceFromBottom - expectedDistance;
  return movedAwayBy <= tolerance;
}
