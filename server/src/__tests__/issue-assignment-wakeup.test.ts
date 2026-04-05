import { describe, expect, it, vi } from "vitest";
import {
  buildIssueWakeContextSnapshot,
  queueIssueAssignmentWakeup,
} from "../services/issue-assignment-wakeup.js";

describe("buildIssueWakeContextSnapshot", () => {
  it("includes task title and body for adapter prompts", () => {
    expect(
      buildIssueWakeContextSnapshot(
        {
          id: "issue-1",
          identifier: "HER-2",
          title: "Smoke test worker",
          description: "Post AGENT_OK and then mark the issue done.",
        },
        "issue.create",
      ),
    ).toEqual(
      expect.objectContaining({
        issueId: "issue-1",
        taskId: "issue-1",
        issueIdentifier: "HER-2",
        taskTitle: "Smoke test worker",
        issueTitle: "Smoke test worker",
        taskBody: "Post AGENT_OK and then mark the issue done.",
        issueDescription: "Post AGENT_OK and then mark the issue done.",
        source: "issue.create",
      }),
    );
  });
});

describe("queueIssueAssignmentWakeup", () => {
  it("passes title and description through to the wake context snapshot", async () => {
    const wakeup = vi.fn().mockResolvedValue(undefined);

    await queueIssueAssignmentWakeup({
      heartbeat: { wakeup },
      issue: {
        id: "issue-1",
        identifier: "HER-2",
        title: "Smoke test worker",
        description: "Post AGENT_OK and then mark the issue done.",
        assigneeAgentId: "agent-1",
        status: "todo",
      },
      reason: "issue_assigned",
      mutation: "create",
      contextSource: "issue.create",
      requestedByActorType: "user",
      requestedByActorId: "local-board",
    });

    expect(wakeup).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        reason: "issue_assigned",
        contextSnapshot: expect.objectContaining({
          issueId: "issue-1",
          taskId: "issue-1",
          taskTitle: "Smoke test worker",
          taskBody: "Post AGENT_OK and then mark the issue done.",
          source: "issue.create",
        }),
      }),
    );
  });
});
