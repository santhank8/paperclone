import { describe, expect, it } from "vitest";
import { resolveCommentAuthorIdentity } from "./comment-authors";

describe("resolveCommentAuthorIdentity", () => {
  it("prefers explicit author agent over run agent", () => {
    expect(
      resolveCommentAuthorIdentity(
        {
          authorAgentId: "agent-a",
          authorUserId: null,
          runAgentId: "agent-b",
        },
        "user-1",
      ),
    ).toEqual({ kind: "agent", agentId: "agent-a" });
  });

  it("uses run agent when author agent is absent", () => {
    expect(
      resolveCommentAuthorIdentity(
        {
          authorAgentId: null,
          authorUserId: null,
          runAgentId: "run-agent",
        },
        null,
      ),
    ).toEqual({ kind: "agent", agentId: "run-agent" });
  });

  it("labels current user comments as You", () => {
    expect(
      resolveCommentAuthorIdentity(
        {
          authorAgentId: null,
          authorUserId: "user-1",
          runAgentId: null,
        },
        "user-1",
      ),
    ).toEqual({ kind: "user", label: "You" });
  });

  it("falls back to board label for other user comments", () => {
    expect(
      resolveCommentAuthorIdentity(
        {
          authorAgentId: null,
          authorUserId: "local-board",
          runAgentId: null,
        },
        "user-1",
      ),
    ).toEqual({ kind: "user", label: "Board" });
  });
});
