import { describe, expect, it } from "vitest";
import { applyInheritedIssueCreateContext } from "../routes/issues.ts";

describe("applyInheritedIssueCreateContext", () => {
  it("inherits projectId and goalId from the parent when omitted", () => {
    expect(
      applyInheritedIssueCreateContext(
        {
          title: "Child",
          parentId: "parent-1",
        },
        {
          projectId: "project-1",
          goalId: "goal-1",
        },
      ),
    ).toMatchObject({
      title: "Child",
      parentId: "parent-1",
      projectId: "project-1",
      goalId: "goal-1",
    });
  });

  it("preserves explicitly provided projectId and goalId", () => {
    expect(
      applyInheritedIssueCreateContext(
        {
          title: "Child",
          parentId: "parent-1",
          projectId: "project-explicit",
          goalId: null,
        },
        {
          projectId: "project-parent",
          goalId: "goal-parent",
        },
      ),
    ).toMatchObject({
      projectId: "project-explicit",
      goalId: null,
    });
  });

  it("returns the original body when there is no parent context", () => {
    expect(
      applyInheritedIssueCreateContext(
        {
          title: "Standalone",
        },
        null,
      ),
    ).toMatchObject({
      title: "Standalone",
    });
  });
});
