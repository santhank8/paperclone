export type BlogPipelineLane = "publish" | "draft_only" | "report";

export function normalizeBlogPipelineLane(value: string | null | undefined): BlogPipelineLane {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "report") return "report";
  if (normalized === "draft_only" || normalized === "draft-only" || normalized === "draft") return "draft_only";
  return "publish";
}

export function isWordPressWriteAllowedForLane(lane: string | null | undefined): boolean {
  return normalizeBlogPipelineLane(lane) !== "report";
}

export function assertWordPressWriteAllowedForLane(lane: string | null | undefined): void {
  const normalized = normalizeBlogPipelineLane(lane);
  if (normalized === "report") {
    throw new Error("wordpress_write_forbidden:report_lane");
  }
}
