import { describe, expect, it } from "vitest";
import {
  summarizeHeartbeatRunResultJson,
  buildHeartbeatRunIssueComment,
} from "../services/heartbeat-run-summary.js";

describe("summarizeHeartbeatRunResultJson", () => {
  it("includes blog pipeline result fields in the summary", () => {
    const summary = summarizeHeartbeatRunResultJson({
      blogRunId: "run-123",
      currentStep: "publish",
      status: "published",
      publishedUrl: "https://fluxaivory.com/test-post/",
      postId: 321,
      message: "publish complete",
    });

    expect(summary).toEqual({
      blogRunId: "run-123",
      currentStep: "publish",
      status: "published",
      publishedUrl: "https://fluxaivory.com/test-post/",
      postId: 321,
      message: "publish complete",
    });
  });
});

describe("buildHeartbeatRunIssueComment", () => {
  it("uses the final summary text for issue comments on successful runs", () => {
    const comment = buildHeartbeatRunIssueComment({
      summary: "## Summary\n\n- fixed deploy config\n- posted issue update",
    });

    expect(comment).toContain("## Summary");
    expect(comment).toContain("- fixed deploy config");
    expect(comment).not.toContain("Run summary");
  });

  it("falls back to result or message when summary is missing", () => {
    expect(buildHeartbeatRunIssueComment({ result: "done" })).toBe("done");
    expect(buildHeartbeatRunIssueComment({ message: "completed" })).toBe("completed");
  });

  it("returns null when there is no usable final text", () => {
    expect(buildHeartbeatRunIssueComment({ costUsd: 1.2 })).toBeNull();
  });
});
