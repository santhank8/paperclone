import { describe, expect, it } from "vitest";
import { defaultPermissionsForRole, normalizeAgentPermissions } from "../services/agent-permissions.js";

describe("agent task-management permissions", () => {
  it("defaults CEOs to task-management access", () => {
    expect(defaultPermissionsForRole("ceo")).toEqual({
      canCreateAgents: true,
      canManageTasks: true,
    });
  });

  it("defaults non-CEOs to no task-management access", () => {
    expect(defaultPermissionsForRole("engineer")).toEqual({
      canCreateAgents: false,
      canManageTasks: false,
    });
  });

  it("preserves explicit permission overrides", () => {
    expect(
      normalizeAgentPermissions(
        { canCreateAgents: false, canManageTasks: true },
        "manager",
      ),
    ).toEqual({
      canCreateAgents: false,
      canManageTasks: true,
    });
  });
});
