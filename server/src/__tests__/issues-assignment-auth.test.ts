import { describe, expect, it } from "vitest";
import { applyAgentCreateIssueDefaults, canAgentAssignToSelfOrDescendant } from "../routes/issues.ts";

describe("canAgentAssignToSelfOrDescendant", () => {
  it("allows self-assignment", () => {
    expect(canAgentAssignToSelfOrDescendant("agent-1", "agent-1", [])).toBe(true);
  });

  it("allows assignment to a descendant in chain of command", () => {
    expect(
      canAgentAssignToSelfOrDescendant("manager-1", "worker-1", [
        { id: "manager-1" },
        { id: "ceo-1" },
      ]),
    ).toBe(true);
  });

  it("rejects assignment outside the actor chain", () => {
    expect(
      canAgentAssignToSelfOrDescendant("manager-2", "worker-1", [
        { id: "manager-1" },
        { id: "ceo-1" },
      ]),
    ).toBe(false);
  });
});

describe("applyAgentCreateIssueDefaults", () => {
  it("auto-assigns agent-created issues back to the actor when no assignee is provided", () => {
    const result = applyAgentCreateIssueDefaults(
      { type: "agent", agentId: "agent-1" } as never,
      { title: "Test issue", status: "todo" },
    );

    expect(result).toMatchObject({
      title: "Test issue",
      status: "todo",
      assigneeAgentId: "agent-1",
    });
  });

  it("preserves explicit assignee choices", () => {
    const result = applyAgentCreateIssueDefaults(
      { type: "agent", agentId: "agent-1" } as never,
      { title: "Test issue", assigneeAgentId: "agent-2" },
    );

    expect(result).toMatchObject({
      title: "Test issue",
      assigneeAgentId: "agent-2",
    });
  });
});
