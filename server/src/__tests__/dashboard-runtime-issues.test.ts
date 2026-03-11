import { describe, expect, it } from "vitest";
import {
  hasHeartbeatOperatorAttentionRequest,
  hasHeartbeatRuntimeIssue,
} from "../services/heartbeat-runtime-issues.ts";

describe("hasHeartbeatRuntimeIssue", () => {
  it("detects missing mounted project workspace paths", () => {
    expect(
      hasHeartbeatRuntimeIssue({
        status: "succeeded",
        stderrExcerpt:
          'Project workspace path "/Users/juandi/Documents/github/CalenBookAI-WongDitgitalDentistry-Website" is not available yet. Using fallback workspace "/paperclip/instances/default/workspaces/x" for this run.',
      }),
    ).toBe(true);
  });

  it("detects stale saved session workspace paths", () => {
    expect(
      hasHeartbeatRuntimeIssue({
        status: "blocked",
        stderrExcerpt:
          'Saved session workspace "/old/path" is not available. Using fallback workspace "/paperclip/instances/default/workspaces/x" for this run.',
      }),
    ).toBe(true);
  });

  it("ignores generic fallback chatter that is not a real infra problem", () => {
    expect(
      hasHeartbeatRuntimeIssue({
        status: "succeeded",
        stderrExcerpt:
          'No project or prior session workspace was available. Using fallback workspace "/paperclip/instances/default/workspaces/x" for this run.',
      }),
    ).toBe(false);
  });

  it("detects operator-attention runs hidden in result_json", () => {
    expect(
      hasHeartbeatRuntimeIssue({
        status: "succeeded",
        resultJson: {
          result:
            "I need shell access to run the Paperclip heartbeat. The bash commands are being blocked.",
        },
      }),
    ).toBe(true);
  });

  it("detects successful runs that request human confirmation", () => {
    expect(
      hasHeartbeatOperatorAttentionRequest({
        status: "succeeded",
        resultJson: {
          result: `Operational workspace is initialized.\n\nTo finalize the deployment architecture brief, I need four confirmations:\n1. Existing S3 bucket(s)/region and whether CloudFront is already in front.\n2. Current CI/CD platform and IAM deployment boundaries.`,
        },
      }),
    ).toBe(true);
  });

  it("ignores normal successful summaries that do not ask for operator input", () => {
    expect(
      hasHeartbeatOperatorAttentionRequest({
        status: "succeeded",
        resultJson: {
          result: "Migration brief completed and posted to the issue.",
        },
      }),
    ).toBe(false);
  });
});
